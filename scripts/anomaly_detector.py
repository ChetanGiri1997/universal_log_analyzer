#!/usr/bin/env python3
"""
Anomaly Detector for Log Analysis
Detects unusual patterns in log data using both rule-based and ML approaches
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from collections import defaultdict, Counter
import argparse

import pymongo
from pymongo import MongoClient
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class AnomalyResult:
    timestamp: datetime
    anomaly_type: str
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    description: str
    affected_templates: List[int]
    log_count: int
    score: float
    details: Dict[str, Any]

class LogAnomalyDetector:
    def __init__(self, mongodb_url: str = "mongodb://localhost:27017", 
                 db_name: str = "log_analyzer"):
        self.client = MongoClient(mongodb_url)
        self.db = self.client[db_name]
        self.logs_collection = self.db.logs
        self.templates_collection = self.db.templates
        self.anomalies_collection = self.db.anomalies
        
        # Initialize anomalies collection if it doesn't exist
        if "anomalies" not in self.db.list_collection_names():
            self.db.create_collection("anomalies")
            self.anomalies_collection.create_index([("timestamp", -1)])
            self.anomalies_collection.create_index([("severity", 1)])
        
        # Configuration
        self.config = {
            "volume_spike_threshold": 3.0,  # Standard deviations
            "error_rate_threshold": 0.1,   # 10%
            "new_template_threshold": 0.05, # 5% of total templates
            "rare_template_percentile": 5,  # Bottom 5%
            "time_window_minutes": 60,
            "isolation_forest_contamination": 0.1
        }
    
    def get_recent_logs(self, hours: int = 24) -> pd.DataFrame:
        """Fetch recent logs from MongoDB"""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        pipeline = [
            {"$match": {"timestamp": {"$gte": since}}},
            {"$project": {
                "timestamp": 1,
                "level": 1,
                "message": 1,
                "source": 1,
                "template_id": 1,
                "template": 1
            }}
        ]
        
        cursor = self.logs_collection.aggregate(pipeline)
        logs = list(cursor)
        
        if not logs:
            return pd.DataFrame()
        
        df = pd.DataFrame(logs)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        return df
    
    def detect_volume_anomalies(self, df: pd.DataFrame) -> List[AnomalyResult]:
        """Detect unusual spikes in log volume"""
        anomalies = []
        
        if df.empty:
            return anomalies
        
        # Resample logs by hour
        df_hourly = df.set_index('timestamp').resample('1H').size()
        
        if len(df_hourly) < 3:
            return anomalies
        
        # Calculate rolling statistics
        window = min(24, len(df_hourly) - 1)
        rolling_mean = df_hourly.rolling(window=window).mean()
        rolling_std = df_hourly.rolling(window=window).std()
        
        # Detect spikes
        z_scores = (df_hourly - rolling_mean) / (rolling_std + 1e-6)
        
        for timestamp, z_score in z_scores.items():
            if abs(z_score) > self.config["volume_spike_threshold"]:
                severity = "HIGH" if abs(z_score) > 5 else "MEDIUM"
                log_count = int(df_hourly[timestamp])
                
                anomaly = AnomalyResult(
                    timestamp=timestamp,
                    anomaly_type="VOLUME_SPIKE" if z_score > 0 else "VOLUME_DROP",
                    severity=severity,
                    description=f"{'Unusual spike' if z_score > 0 else 'Unusual drop'} in log volume: {log_count} logs (z-score: {z_score:.2f})",
                    affected_templates=[],
                    log_count=log_count,
                    score=float(abs(z_score)),
                    details={
                        "z_score": float(z_score),
                        "expected_range": f"{rolling_mean[timestamp]:.1f} ± {rolling_std[timestamp]:.1f}",
                        "actual_count": log_count
                    }
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def detect_error_rate_anomalies(self, df: pd.DataFrame) -> List[AnomalyResult]:
        """Detect unusual error rates"""
        anomalies = []
        
        if df.empty:
            return anomalies
        
        # Define error levels
        error_levels = ['ERROR', 'CRITICAL', 'FATAL', 'WARN']
        
        # Group by hour and calculate error rates
        df_hourly = df.set_index('timestamp').groupby([
            pd.Grouper(freq='1H'), 'level'
        ]).size().unstack(fill_value=0)
        
        if df_hourly.empty:
            return anomalies
        
        # Calculate error rate for each hour
        total_logs = df_hourly.sum(axis=1)
        error_logs = df_hourly[error_levels].sum(axis=1) if any(col in df_hourly.columns for col in error_levels) else pd.Series(0, index=df_hourly.index)
        error_rate = error_logs / (total_logs + 1e-6)
        
        # Historical baseline (excluding current hour)
        baseline_error_rate = error_rate[:-1].mean() if len(error_rate) > 1 else 0
        
        for timestamp, rate in error_rate.items():
            if rate > self.config["error_rate_threshold"] and rate > baseline_error_rate * 2:
                severity = "CRITICAL" if rate > 0.5 else "HIGH"
                
                anomaly = AnomalyResult(
                    timestamp=timestamp,
                    anomaly_type="HIGH_ERROR_RATE",
                    severity=severity,
                    description=f"High error rate detected: {rate:.2%} ({error_logs[timestamp]} errors out of {total_logs[timestamp]} logs)",
                    affected_templates=[],
                    log_count=int(total_logs[timestamp]),
                    score=float(rate),
                    details={
                        "error_rate": float(rate),
                        "error_count": int(error_logs[timestamp]),
                        "total_count": int(total_logs[timestamp]),
                        "baseline_rate": float(baseline_error_rate)
                    }
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def detect_new_template_anomalies(self, df: pd.DataFrame) -> List[AnomalyResult]:
        """Detect emergence of new log templates"""
        anomalies = []
        
        if df.empty:
            return anomalies
        
        # Get template statistics
        template_stats = df.groupby('template_id').agg({
            'timestamp': ['min', 'max', 'count'],
            'template': 'first'
        }).round(2)
        
        template_stats.columns = ['first_seen', 'last_seen', 'count', 'template']
        
        # Find recently emerged templates (first seen in last 24 hours)
        recent_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        new_templates = template_stats[template_stats['first_seen'] >= recent_cutoff]
        
        total_templates = len(template_stats)
        new_template_ratio = len(new_templates) / max(total_templates, 1)
        
        if new_template_ratio > self.config["new_template_threshold"]:
            severity = "HIGH" if new_template_ratio > 0.2 else "MEDIUM"
            
            anomaly = AnomalyResult(
                timestamp=datetime.now(timezone.utc),
                anomaly_type="NEW_TEMPLATE_SURGE",
                severity=severity,
                description=f"Unusual number of new log templates: {len(new_templates)} new templates ({new_template_ratio:.1%} of total)",
                affected_templates=list(new_templates.index),
                log_count=int(new_templates['count'].sum()),
                score=float(new_template_ratio),
                details={
                    "new_template_count": len(new_templates),
                    "total_template_count": total_templates,
                    "ratio": float(new_template_ratio),
                    "new_templates": [
                        {
                            "template_id": int(tid),
                            "template": row['template'],
                            "count": int(row['count']),
                            "first_seen": row['first_seen'].isoformat()
                        }
                        for tid, row in new_templates.iterrows()
                    ]
                }
            )
            anomalies.append(anomaly)
        
        return anomalies
    
    def detect_rare_template_anomalies(self, df: pd.DataFrame) -> List[AnomalyResult]:
        """Detect sudden activity in rare templates"""
        anomalies = []
        
        if df.empty:
            return anomalies
        
        # Get template frequency over longer period (7 days)
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        historical_pipeline = [
            {"$match": {"timestamp": {"$gte": week_ago}}},
            {"$group": {"_id": "$template_id", "count": {"$sum": 1}}}
        ]
        
        historical_counts = list(self.logs_collection.aggregate(historical_pipeline))
        if not historical_counts:
            return anomalies
        
        hist_df = pd.DataFrame(historical_counts)
        hist_df = hist_df.set_index('_id')['count']
        
        # Identify rare templates (bottom percentile)
        rare_threshold = np.percentile(hist_df.values, self.config["rare_template_percentile"])
        rare_templates = hist_df[hist_df <= rare_threshold].index.tolist()
        
        # Check recent activity in rare templates (last 2 hours)
        recent_cutoff = datetime.now(timezone.utc) - timedelta(hours=2)
        recent_rare = df[
            (df['template_id'].isin(rare_templates)) & 
            (df['timestamp'] >= recent_cutoff)
        ]
        
        if not recent_rare.empty:
            rare_activity = recent_rare.groupby('template_id').agg({
                'timestamp': 'count',
                'template': 'first'
            })
            rare_activity.columns = ['recent_count', 'template']
            
            # Flag templates with unusual recent activity
            for template_id, row in rare_activity.iterrows():
                if row['recent_count'] > rare_threshold * 3:  # 3x the rare threshold
                    severity = "MEDIUM"
                    
                    anomaly = AnomalyResult(
                        timestamp=datetime.now(timezone.utc),
                        anomaly_type="RARE_TEMPLATE_ACTIVITY",
                        severity=severity,
                        description=f"Unusual activity in rare template: '{row['template'][:100]}...' ({row['recent_count']} occurrences)",
                        affected_templates=[int(template_id)],
                        log_count=int(row['recent_count']),
                        score=float(row['recent_count'] / rare_threshold),
                        details={
                            "template_id": int(template_id),
                            "template": row['template'],
                            "recent_count": int(row['recent_count']),
                            "historical_avg": float(hist_df.get(template_id, 0)),
                            "rare_threshold": float(rare_threshold)
                        }
                    )
                    anomalies.append(anomaly)
        
        return anomalies
    
    def detect_ml_anomalies(self, df: pd.DataFrame) -> List[AnomalyResult]:
        """Use ML-based approach to detect anomalies"""
        anomalies = []
        
        if df.empty or len(df) < 100:  # Need sufficient data
            return anomalies
        
        try:
            # Feature engineering
            df_features = df.copy()
            df_features['hour'] = df_features['timestamp'].dt.hour
            df_features['day_of_week'] = df_features['timestamp'].dt.dayofweek
            df_features['is_error'] = df_features['level'].isin(['ERROR', 'CRITICAL', 'FATAL']).astype(int)
            
            # Aggregate features by hour
            hourly_features = df_features.set_index('timestamp').resample('1H').agg({
                'level': 'count',  # Total logs
                'is_error': 'sum',  # Error count
                'template_id': 'nunique',  # Unique templates
                'source': 'nunique',  # Unique sources
                'hour': 'first',
                'day_of_week': 'first'
            }).fillna(0)
            
            if len(hourly_features) < 24:  # Need at least 24 hours of data
                return anomalies
            
            # Prepare features for Isolation Forest
            feature_columns = ['level', 'is_error', 'template_id', 'source', 'hour', 'day_of_week']
            X = hourly_features[feature_columns].values
            
            # Scale features
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            # Apply Isolation Forest
            iso_forest = IsolationForest(
                contamination=self.config["isolation_forest_contamination"],
                random_state=42
            )
            
            outlier_labels = iso_forest.fit_predict(X_scaled)
            anomaly_scores = iso_forest.decision_function(X_scaled)
            
            # Process results
            for i, (timestamp, is_outlier) in enumerate(zip(hourly_features.index, outlier_labels)):
                if is_outlier == -1:  # Anomaly detected
                    score = abs(anomaly_scores[i])
                    severity = "HIGH" if score > 0.5 else "MEDIUM"
                    
                    anomaly = AnomalyResult(
                        timestamp=timestamp,
                        anomaly_type="ML_DETECTED_ANOMALY",
                        severity=severity,
                        description=f"ML model detected anomalous log pattern (score: {score:.3f})",
                        affected_templates=[],
                        log_count=int(hourly_features.iloc[i]['level']),
                        score=float(score),
                        details={
                            "ml_score": float(anomaly_scores[i]),
                            "features": {
                                col: float(hourly_features.iloc[i][col]) 
                                for col in feature_columns
                            }
                        }
                    )
                    anomalies.append(anomaly)
        
        except Exception as e:
            logger.error(f"Error in ML anomaly detection: {e}")
        
        return anomalies
    
    def detect_source_anomalies(self, df: pd.DataFrame) -> List[AnomalyResult]:
        """Detect anomalies in log sources"""
        anomalies = []
        
        if df.empty:
            return anomalies
        
        # Analyze source activity patterns
        source_activity = df.groupby(['source', pd.Grouper(key='timestamp', freq='1H')]).size().unstack(fill_value=0)
        
        if source_activity.empty:
            return anomalies
        
        # Detect sources with unusual silence (no logs when they usually have them)
        for source in source_activity.index:
            source_data = source_activity.loc[source]
            
            # Skip if source has very little historical data
            if source_data.sum() < 10:
                continue
            
            # Check for unusual silence (no logs in last 2 hours when historically active)
            recent_activity = source_data.iloc[-2:].sum()  # Last 2 hours
            historical_avg = source_data.iloc[:-2].mean() if len(source_data) > 2 else 0
            
            if recent_activity == 0 and historical_avg > 5:  # Silent when usually active
                severity = "MEDIUM"
                
                anomaly = AnomalyResult(
                    timestamp=datetime.now(timezone.utc),
                    anomaly_type="SOURCE_SILENCE",
                    severity=severity,
                    description=f"Source '{source}' has gone silent (usually produces {historical_avg:.1f} logs/hour)",
                    affected_templates=[],
                    log_count=0,
                    score=float(historical_avg),
                    details={
                        "source": source,
                        "historical_avg": float(historical_avg),
                        "silent_hours": 2
                    }
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def store_anomaly(self, anomaly: AnomalyResult):
        """Store anomaly in MongoDB"""
        doc = {
            "timestamp": anomaly.timestamp,
            "anomaly_type": anomaly.anomaly_type,
            "severity": anomaly.severity,
            "description": anomaly.description,
            "affected_templates": anomaly.affected_templates,
            "log_count": anomaly.log_count,
            "score": anomaly.score,
            "details": anomaly.details,
            "created_at": datetime.now(timezone.utc)
        }
        
        try:
            self.anomalies_collection.insert_one(doc)
            logger.info(f"Stored anomaly: {anomaly.anomaly_type} - {anomaly.description}")
        except Exception as e:
            logger.error(f"Error storing anomaly: {e}")
    
    def run_detection(self, hours: int = 24) -> List[AnomalyResult]:
        """Run all anomaly detection methods"""
        logger.info(f"Starting anomaly detection for last {hours} hours")
        
        # Fetch recent logs
        df = self.get_recent_logs(hours)
        logger.info(f"Analyzing {len(df)} logs")
        
        all_anomalies = []
        
        # Run all detection methods
        detectors = [
            ("Volume", self.detect_volume_anomalies),
            ("Error Rate", self.detect_error_rate_anomalies),
            ("New Templates", self.detect_new_template_anomalies),
            ("Rare Templates", self.detect_rare_template_anomalies),
            ("ML-based", self.detect_ml_anomalies),
            ("Source", self.detect_source_anomalies)
        ]
        
        for name, detector in detectors:
            try:
                logger.info(f"Running {name} anomaly detection...")
                anomalies = detector(df)
                all_anomalies.extend(anomalies)
                logger.info(f"Found {len(anomalies)} {name.lower()} anomalies")
            except Exception as e:
                logger.error(f"Error in {name} detection: {e}")
        
        # Store anomalies
        for anomaly in all_anomalies:
            self.store_anomaly(anomaly)
        
        logger.info(f"Total anomalies detected: {len(all_anomalies)}")
        return all_anomalies
    
    def get_recent_anomalies(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get recent anomalies from database"""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        cursor = self.anomalies_collection.find(
            {"timestamp": {"$gte": since}}
        ).sort("timestamp", -1)
        
        return list(cursor)

def main():
    parser = argparse.ArgumentParser(description="Log Anomaly Detector")
    parser.add_argument("--mongodb-url", default="mongodb://localhost:27017", help="MongoDB connection URL")
    parser.add_argument("--db-name", default="log_analyzer", help="Database name")
    parser.add_argument("--hours", type=int, default=24, help="Hours of data to analyze")
    parser.add_argument("--output", help="Output file for anomalies (JSON)")
    parser.add_argument("--daemon", action="store_true", help="Run as daemon (continuous detection)")
    parser.add_argument("--interval", type=int, default=300, help="Detection interval in seconds (daemon mode)")
    
    args = parser.parse_args()
    
    detector = LogAnomalyDetector(args.mongodb_url, args.db_name)
    
    if args.daemon:
        import time
        logger.info(f"Starting daemon mode with {args.interval}s interval")
        
        while True:
            try:
                anomalies = detector.run_detection(args.hours)
                logger.info(f"Daemon cycle complete. Found {len(anomalies)} anomalies.")
                time.sleep(args.interval)
            except KeyboardInterrupt:
                logger.info("Daemon stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in daemon cycle: {e}")
                time.sleep(60)  # Wait before retrying
    else:
        # Single run
        anomalies = detector.run_detection(args.hours)
        
        # Output results
        if args.output:
            results = []
            for anomaly in anomalies:
                results.append({
                    "timestamp": anomaly.timestamp.isoformat(),
                    "type": anomaly.anomaly_type,
                    "severity": anomaly.severity,
                    "description": anomaly.description,
                    "score": anomaly.score,
                    "details": anomaly.details
                })
            
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2)
            
            logger.info(f"Results saved to {args.output}")
        else:
            # Print to console
            print(f"\n{'='*60}")
            print(f"ANOMALY DETECTION REPORT")
            print(f"{'='*60}")
            print(f"Analysis Period: Last {args.hours} hours")
            print(f"Total Anomalies: {len(anomalies)}")
            print(f"{'='*60}")
            
            for anomaly in sorted(anomalies, key=lambda x: x.severity, reverse=True):
                print(f"\n[{anomaly.severity}] {anomaly.anomaly_type}")
                print(f"Time: {anomaly.timestamp}")
                print(f"Description: {anomaly.description}")
                print(f"Score: {anomaly.score:.3f}")
                if anomaly.affected_templates:
                    print(f"Affected Templates: {anomaly.affected_templates}")
                print("-" * 40)

if __name__ == "__main__":
    main()
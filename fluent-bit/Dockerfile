
# Dockerfile
FROM fluent/fluent-bit:2.2.0

# Copy configuration files
COPY fluent-bit.conf /fluent-bit/conf/fluent-bit.conf
COPY parsers.conf /fluent-bit/conf/parsers.conf

# Expose forward port
EXPOSE 24224

# Use the default command from base image
CMD ["/fluent-bit/bin/fluent-bit", "--config=/fluent-bit/conf/fluent-bit.conf"]

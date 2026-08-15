FROM postgres:18.6

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

RUN echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen && \
    apt-get update && \
    apt-get install --assume-yes --no-install-recommends awscli && \
    locale-gen en_US.utf8 && \
    update-locale && \
    rm -rf /var/lib/apt/lists/*

COPY --chmod=500 ./bin/backup.sh /bin/backup
COPY --chmod=500 ./bin/list-backups.sh /bin/list-backups
COPY --chmod=500 ./bin/restore.sh /bin/restore

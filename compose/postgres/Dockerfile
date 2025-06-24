FROM postgres:17

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

RUN echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen && \
    apt-get update && apt-get --assume-yes install python3-pip curl && \
    apt install awscli --assume-yes && \
    locale-gen en_US.utf8 && update-locale && \
    curl https://raw.githubusercontent.com/a2f0/pg-container-utils/main/bin/backup.sh > /bin/backup && \
    chmod 500 /bin/backup && \
    curl https://raw.githubusercontent.com/a2f0/pg-container-utils/main/bin/list-backups.sh > /bin/list-backups && \
    chmod 500 /bin/list-backups && \
    curl https://raw.githubusercontent.com/a2f0/pg-container-utils/main/bin/restore.sh > /bin/restore && \
    chmod 500 /bin/restore

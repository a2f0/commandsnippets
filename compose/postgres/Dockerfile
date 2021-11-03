FROM postgres:11

RUN apt-get update && apt-get --assume-yes install python-pip curl && \
    pip install awscli --upgrade && \
    curl https://raw.githubusercontent.com/a2f0/pg-container-utils/main/bin/backup.sh > /bin/backup && \
    chmod 500 /bin/backup && \
    curl https://raw.githubusercontent.com/a2f0/pg-container-utils/main/bin/list-backups.sh > /bin/list-backups && \
    chmod 500 /bin/list-backups && \
    curl https://raw.githubusercontent.com/a2f0/pg-container-utils/main/bin/restore.sh > /bin/restore && \
    chmod 500 /bin/restore

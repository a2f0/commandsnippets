FROM postgres:11

COPY ./backup.sh /bin/backup
COPY ./list-backups.sh /bin/list-backups
COPY ./restore.sh /bin/restore
RUN chmod 500 /bin/backup /bin/list-backups /bin/restore
FROM postgres:11

RUN apt-get update && apt-get --assume-yes install python-pip

RUN pip install awscli --upgrade

COPY ./backup.sh /bin/backup
COPY ./list-backups.sh /bin/list-backups
COPY ./restore.sh /bin/restore
RUN chmod 500 /bin/backup /bin/list-backups /bin/restore

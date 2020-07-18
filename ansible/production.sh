#!/bin/sh
ansible-playbook -i inventory.yaml playbook.yaml -l production


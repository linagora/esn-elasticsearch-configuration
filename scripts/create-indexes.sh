#!/bin/bash

es_host="localhost"
es_port="9200"
current_path="$(dirname "$0")"

[ -z "$ELASTICSEARCH_HOST" ] || es_host="$ELASTICSEARCH_HOST"
[ -z "$ELASTICSEARCH_PORT" ] || es_port="$ELASTICSEARCH_PORT"

echo -e "Setting up users index"
curl -s -i -XPUT "${es_host}:${es_port}/users.idx" -d @${current_path}/../data/users.json

echo -e "Setting up contacts index"
curl -s -i -XPUT "${es_host}:${es_port}/contacts.idx" -d @${current_path}/../data/contacts.json

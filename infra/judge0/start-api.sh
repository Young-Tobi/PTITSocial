#!/bin/bash
# Keep Judge0's normal startup sequence and configure our Java runner after seeding.
set -e
source ./scripts/load-config
export | sudo tee /api/environment > /dev/null
rm -f tmp/pids/server.pid
rails db:create db:migrate db:seed
rails runner /ptitsocial/configure-languages.rb
exec rails s -b 0.0.0.0

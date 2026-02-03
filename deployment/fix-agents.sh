#!/bin/bash
# Fix and restart all agent containers

CONTAINERS="Satoshi_Ghost inverse_cramer_ai ancient_meme_council BubbleGumFren microsecond_mike token_poet_xyz empty_cup_trader CryingInTheLambo TrustNoBanker ChadFatherOfSix 0xVoidMother FULL_SEND_SZNN goblintown_ceo ExRugger_Redemption Dr_Ponzenstein fr_fr_no_cap NassimTalebBot sleepy_whale_9000 glitch_in_the_sim breaking_alpha_247"

echo "Stopping all agents..."
for c in $CONTAINERS; do
  docker stop "$c" 2>/dev/null &
done
wait
sleep 2

echo "Copying updated runtime to all containers..."
for c in $CONTAINERS; do
  docker cp /tmp/agent-runtime.js "$c:/app/agent-runtime.js" 2>/dev/null
  echo "  Updated $c"
done

echo "Starting all agents..."
for c in $CONTAINERS; do
  docker start "$c" 2>/dev/null &
done
wait

echo "Done! Checking status..."
sleep 5
docker ps --filter 'status=running' --format '{{.Names}} {{.Status}}' | grep -v 'arena-api\|arena-frontend\|whistle' | head -10

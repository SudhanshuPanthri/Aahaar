#!/usr/bin/env bash
# Regression sweep for the /estimate prompt: known foods vs sane kcal ranges.
# Run after any prompt change + deploy:  bash check-estimates.sh
# ponytail: range assertions on total kcal only — add protein ranges if drift shows up there
URL="${1:-https://aahaar-parser.aahaar.workers.dev}/estimate"
fail=0

check() { # food qty unit min_kcal max_kcal
  local body; body=$(curl -s -X POST "$URL" -H 'Content-Type: application/json' \
    -d "{\"food\":\"$1\",\"quantity\":$2,\"unit\":\"$3\"}")
  local kcal; kcal=$(node -e "const r=$body; console.log(Math.round(r.grams*r.per100g.calories/100))" 2>/dev/null)
  if [ -z "$kcal" ] || [ "$kcal" -lt "$4" ] || [ "$kcal" -gt "$5" ]; then
    echo "FAIL  $2 $3 $1 -> ${kcal:-parse-error} kcal (want $4-$5)  raw: $body"; fail=1
  else
    echo "ok    $2 $3 $1 -> $kcal kcal (want $4-$5)"
  fi
}

check "cold coffee"     180 ml      110 200
check "black coffee"    180 ml      0   15
check "soya cheela"     50  g       150 260   # dry-basis: ~26g protein
check "dahi"            1   katori  80  120
check "dal tadka"       1   katori  150 250
check "roti"            2   roti    180 260
check "chicken biryani" 1   plate   350 650
check "oats"            40  g       140 180
check "poha"            1   plate   230 420
check "chai"            1   cup     70  130
check "maggi"           1   serving 280 420
check "aloo paratha"    1   piece   170 300
check "paneer"          100 g       250 330

exit $fail

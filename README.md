# dobble

## demo here

https://stepanoidteam.github.io/dobble/

## hosted demo

https://dobble.top/

https://dobble-78869.web.app/

## to run locally (and disable cache):

`% http-server ./ -c-1`

## to deploy, run:

`% firebase deploy`

if fails, re-login first:

`% firebase login --reauth`

to update only fb🔥 firestore rules:

`% firebase deploy --only firestore:rules`

for realtime database:

`% firebase deploy --only database`

for cloud functions:

`% firebase deploy --only functions`

## deployment versioning

A predeploy hook writes version.json with git metadata and timestamp.
After deploy, open hosted `/version.json`
~~or check the footer on the landing page~~
to see the last deployed version and time.
version.json contains:
commit, short, tag (if present), branch, author, commitDate, timestamp.

File is ignored by git and regenerated on each deploy.

### Advanced:

to add readable tag use:

`% git tag v0.0.1 && git push --tags`

## references

### rules

https://planeta-igr.com/image/data/instrukcii/58122.pdf?srsltid=AfmBOooUbhL48KPJffYwcgcJfAo9KVlRmBgC-PkY700NIMK-pofpCxln

## rules briefly

### helltower

one shared pile
each takes card to his hand from it
who got most cards win

### well

one shared
each has own pile
each puts his cards to shared pile
first zero cards wins

### hot potato

--- minigame

### poisoned gift

each has 1 start card
shared pile
find match between pile and other players
put cards to your opponents from shared pile
less card owner wins

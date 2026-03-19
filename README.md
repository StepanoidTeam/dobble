# dobble

## demo here

https://stepanoidteam.github.io/dobble/

## hosted demo

https://dobble-78869.web.app/

## to deploy, run:

`% firebase deploy`

if fails, re-login first:

`% firebase login --reauth`

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

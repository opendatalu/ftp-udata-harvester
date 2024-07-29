alert() {
    if command -v alert.sh 1>/dev/null; then
        alert.sh "$@"
    fi
}
node.exe main.js >> ./log.txt 2>&1 || alert "${PWD##*/}" log.txt

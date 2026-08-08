#!/bin/bash
# This script should detect the OS, then download and run the relevant installer for that OS
set -e

unameOut="$(uname -s)"
case "${unameOut}" in
    Linux*)     machine=Linux;;
    Darwin*)    machine=Mac;;
    CYGWIN*)    machine=Cygwin;;
    MINGW*)     machine=MinGw;;
    *)          machine="UNKNOWN:${unameOut}"
esac

mac_func() {
    echo "Installing Tunnelmole for Mac OS X"
    curl -O https://tunnelmole.com/sh/install-mac.sh
    if [ "$EUID" -ne 0 ]; then
        osascript -e "do shell script \"bash $PWD/install-mac.sh\" with administrator privileges"
    else
        bash install-mac.sh
    fi
}

linux_func() {
    echo "Installing Tunnelmole for Linux"
    curl -O https://tunnelmole.com/sh/install-linux.sh
    if [ "$EUID" -ne 0 ]; then
        if command -v pkexec >/dev/null 2>&1; then
            pkexec env PATH=$PATH bash "$PWD/install-linux.sh"
        else
            sudo bash "$PWD/install-linux.sh"
        fi
    else
        bash install-linux.sh
    fi
}

if [ "${machine}" == "Linux" ]; then
    linux_func
elif [ "${machine}" == "Mac" ]; then
    mac_func
fi

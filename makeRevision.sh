#!/bin/bash

revFile="src/script/config/revision.json"
echo "{" > ${revFile}
echo "    \"revision\": \"`git rev-parse HEAD`\"" >> ${revFile}
echo "}" >> ${revFile}

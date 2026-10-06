with open('src/components/live-ride-map.tsx', 'r') as f:
    content = f.read()

content = '/// <reference types="google.maps" />\n' + content

with open('src/components/live-ride-map.tsx', 'w') as f:
    f.write(content)

import re

with open('src/components/live-ride-map.tsx', 'r') as f:
    content = f.read()

# Fix implicit any for response and status
content = content.replace('(response, status) => {', '(response: any, status: any) => {')

with open('src/components/live-ride-map.tsx', 'w') as f:
    f.write(content)

with open('src/routes/__root.tsx', 'r') as f:
    content = f.read()

# Fix __root.tsx ErrorComponent props
content = content.replace('function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {', 'function ErrorComponent({ error, reset }: { error: any; reset: () => void }) {')

with open('src/routes/__root.tsx', 'w') as f:
    f.write(content)

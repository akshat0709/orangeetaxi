with open('src/routes/book.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { useState, useEffect } from 'react';\n\nfunction useMediaQuery", "function useMediaQuery")

with open('src/routes/book.tsx', 'w') as f:
    f.write(content)

import re
with open('src/routes/book.tsx', 'r') as f:
    content = f.read()

old_str = """  onReset?: () => void;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState("searching");"""

new_str = """  onReset?: () => void;
}) {
  const { user } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [status, setStatus] = useState("searching");"""

content = content.replace(old_str, new_str)

with open('src/routes/book.tsx', 'w') as f:
    f.write(content)

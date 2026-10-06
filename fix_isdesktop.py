import re
with open('src/routes/book.tsx', 'r') as f:
    content = f.read()

# Add isDesktop to PassengerPage
old_str = """function PassengerPage() {
  const { t } = useTranslation();"""
new_str = """function PassengerPage() {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery("(min-width: 1024px)");"""

content = content.replace(old_str, new_str)

with open('src/routes/book.tsx', 'w') as f:
    f.write(content)

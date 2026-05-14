export const metadata = {
  title: 'Finance Tracker',
  description: 'Aplikacja do zarządzania finansami z podatkowym',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}

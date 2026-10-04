import { useState, useEffect } from "react";
import { Button } from "./ui/button";

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("orange_cookie_consent");
    if (!consent) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pb-safe pointer-events-none">
      <div className="mx-auto max-w-4xl rounded-2xl bg-foreground text-background shadow-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pointer-events-auto border border-white/10 dark:border-white/5 animate-in slide-in-from-bottom-10 fade-in duration-500">
        <div className="flex-1 text-sm leading-relaxed text-background/90">
          <p>
            <strong>We value your privacy.</strong> We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.
          </p>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-3 shrink-0">
          <Button
            variant="outline"
            className="w-full sm:w-auto bg-transparent border-background/20 text-background hover:bg-background/10 hover:text-background"
            onClick={() => {
              localStorage.setItem("orange_cookie_consent", "rejected");
              setShow(false);
            }}
          >
            Reject All
          </Button>
          <Button
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              localStorage.setItem("orange_cookie_consent", "accepted");
              setShow(false);
            }}
          >
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
}

import type { AnchorHTMLAttributes, ReactNode } from 'react';

/**
 * A link to another site. In the installed app window it opens in a Chrome tab, never inside the app's window: a new
 * browsing context outside the app's scope (target _blank), with no opener and no referrer handed over.
 */
export default function ExternalLink({ href, children, ...rest }: { href: string; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'>) {
  return (
    <a {...rest} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

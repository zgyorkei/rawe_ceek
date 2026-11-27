import ExternalLink from '../components/ExternalLink';
import { InstallButton } from '../components/StatusLines';
import { APP } from '../../app.config';

export default function Home() {
  return (
    <section>
      <h1>{APP.title}</h1>
      <p>
        One app on the phone and on the PC. On a PC, install it from Chrome (the install icon in the address bar, or the
        button below) and it opens in its own window with the desktop layout.
      </p>
      <InstallButton />
      <p>
        Links to other sites open in a Chrome tab, such as{' '}
        <ExternalLink href="https://firebase.google.com/docs/firestore">the Firestore documentation</ExternalLink>.
      </p>
    </section>
  );
}

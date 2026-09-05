import { ProfileDetailPage } from './features/profiles/profile-detail-page';
import { ProfileSearchPage } from './features/search/profile-search-page';

export function App() {
  const match = window.location.pathname.match(
    /^\/profiles\/([0-9a-f-]{36})\/?$/iu,
  );
  if (match?.[1]) {
    return <ProfileDetailPage id={match[1]} />;
  }
  return <ProfileSearchPage />;
}

import type { ProfileCard as ProfileCardContract } from '../../api/contracts';
import { ProfileCard } from './profile-card';

export function ProfileList({ items }: { items: ProfileCardContract[] }) {
  return (
    <div className="profile-list">
      {items.map((profile) => (
        <ProfileCard key={profile.id} profile={profile} />
      ))}
    </div>
  );
}

export function ProfileListSkeleton() {
  return (
    <div
      className="profile-list"
      aria-label="Loading profiles"
      aria-busy="true"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div className="profile-card profile-card--skeleton" key={index}>
          <div className="skeleton skeleton--avatar" />
          <div className="profile-card__body">
            <div className="skeleton skeleton--title" />
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--line skeleton--short" />
            <div className="skeleton skeleton--chips" />
          </div>
        </div>
      ))}
    </div>
  );
}

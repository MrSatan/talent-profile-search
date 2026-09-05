import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getProfile } from '../../api/client';
import { ExternalIcon } from '../../components/icons';

export function ProfileDetailPage({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['profile', id],
    queryFn: ({ signal }) => getProfile(id, signal),
    retry: 1,
  });
  const returnTo = safeReturnPath(
    new URLSearchParams(window.location.search).get('returnTo'),
  );

  if (query.isPending) {
    return (
      <ProfilePageShell>
        <p aria-live="polite">Loading profile…</p>
      </ProfilePageShell>
    );
  }
  if (query.isError) {
    return (
      <ProfilePageShell>
        <section className="state-card state-card--error" role="alert">
          <h1>We couldn’t load this profile.</h1>
          <button
            className="button button--primary"
            onClick={() => void query.refetch()}
            type="button"
          >
            Try again
          </button>
        </section>
      </ProfilePageShell>
    );
  }

  const profile = query.data;
  const linkedinUrl = safeLinkedinUrl(profile.linkedinUrl);
  return (
    <ProfilePageShell>
      <a className="profile-detail__back" href={returnTo}>
        ← Back to search
      </a>
      <article className="profile-detail">
        <header className="profile-detail__header">
          <div>
            <p className="eyebrow">Professional profile</p>
            <h1>{profile.fullName}</h1>
            <p>
              {profile.jobTitle ?? 'Role not specified'}
              {profile.companyName ? ` at ${profile.companyName}` : ''}
            </p>
          </div>
          {linkedinUrl ? (
            <a
              className="button button--primary"
              href={linkedinUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open LinkedIn <ExternalIcon className="icon" />
            </a>
          ) : null}
        </header>

        <dl className="profile-detail__facts">
          <ProfileFact label="Location" value={profile.location} />
          <ProfileFact label="Country" value={profile.country} />
          <ProfileFact label="Industry" value={profile.industry} />
          <ProfileFact
            label="Experience"
            value={formatYears(profile.yearsExperience)}
          />
        </dl>

        {profile.summary ? (
          <ProfileSection title="About">
            <p>{profile.summary}</p>
          </ProfileSection>
        ) : null}

        <ProfileSection title={`Skills (${profile.skills.length})`}>
          {profile.skills.length > 0 ? (
            <ul
              className="skill-list"
              aria-label={`${profile.fullName} skills`}
            >
              {profile.skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          ) : (
            <p>No skills listed.</p>
          )}
        </ProfileSection>

        <ProfileSection title={`Experience (${profile.experience.length})`}>
          {profile.experience.length > 0 ? (
            <ol className="profile-timeline">
              {profile.experience.map((item, index) => (
                <li
                  key={`${item.companyName ?? 'company'}-${item.startDate ?? index}`}
                >
                  <h3>{item.jobTitle ?? 'Role not specified'}</h3>
                  <p className="profile-timeline__meta">
                    {[
                      item.companyName,
                      item.location,
                      formatDateRange(
                        item.startDate,
                        item.endDate,
                        item.isCurrent,
                      ),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {item.description ? <p>{item.description}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p>No experience listed.</p>
          )}
        </ProfileSection>

        <ProfileSection title={`Education (${profile.education.length})`}>
          {profile.education.length > 0 ? (
            <ol className="profile-timeline">
              {profile.education.map((item, index) => (
                <li key={`${item.institution}-${item.startYear ?? index}`}>
                  <h3>{item.institution}</h3>
                  <p className="profile-timeline__meta">
                    {[
                      item.degree,
                      item.fieldOfStudy,
                      formatYearRange(item.startYear, item.endYear),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p>No education listed.</p>
          )}
        </ProfileSection>
      </article>
    </ProfilePageShell>
  );
}

function ProfilePageShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="detail-site-header">
        <a className="brand" href="/" aria-label="Profile Atlas home">
          <span className="brand__mark" aria-hidden="true">
            PA
          </span>
          <span>
            <strong>Profile Atlas</strong>
            <small>Professional discovery</small>
          </span>
        </a>
      </header>
      <main className="profile-detail-layout" id="main-content">
        {children}
      </main>
    </div>
  );
}

function ProfileFact({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return value ? (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  ) : null;
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="profile-detail__section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function safeReturnPath(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}

function safeLinkedinUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      /^(?:www\.)?linkedin\.com$/u.test(url.hostname) &&
      url.pathname.startsWith('/in/')
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function formatYears(years: number | null): string | null {
  if (years === null) {
    return null;
  }
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}

function formatDateRange(
  start: string | null,
  end: string | null,
  isCurrent: boolean | null,
): string | null {
  if (!start && !end && isCurrent !== true) {
    return null;
  }
  return `${start ?? 'Unknown'} – ${isCurrent === true ? 'Present' : (end ?? 'Unknown')}`;
}

function formatYearRange(
  start: number | null,
  end: number | null,
): string | null {
  return start || end ? `${start ?? 'Unknown'} – ${end ?? 'Unknown'}` : null;
}

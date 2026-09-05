import { useId, useState } from 'react';
import type {
  ProfileCard as ProfileCardContract,
  ProfileMatchField,
} from '../../api/contracts';

export function ProfileCard({ profile }: { profile: ProfileCardContract }) {
  const [showAllSkills, setShowAllSkills] = useState(false);
  const skillsId = useId();
  const detailsUrl = `/profiles/${encodeURIComponent(
    profile.id,
  )}?returnTo=${encodeURIComponent(
    `${window.location.pathname}${window.location.search}`,
  )}`;
  const matchedSkills = new Set(profile.matchedSkills);
  const hiddenSkillCount = Math.max(0, profile.skills.length - 12);
  const visibleSkills = showAllSkills ? profile.skills : profile.skills.slice(0, 12);
  const evidence = profile.matches.filter((match) => match.excerpt);
  const initials = profile.fullName
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join('');
  return (
    <article className="profile-card">
      <div className="profile-card__avatar" aria-hidden="true">
        {initials}
      </div>
      <div className="profile-card__body">
        <div className="profile-card__heading">
          <div>
            <h3>{profile.fullName}</h3>
            <p className="profile-card__role">
              {profile.jobTitle ?? 'Role not specified'}
              {profile.companyName ? (
                <>
                  {' '}
                  <span>at {profile.companyName}</span>
                </>
              ) : null}
            </p>
          </div>
          <a className="profile-card__link" href={detailsUrl}>
            View details
          </a>
        </div>

        <dl className="profile-card__facts">
          {profile.location ? (
            <div>
              <dt>Location</dt>
              <dd>{profile.location}</dd>
            </div>
          ) : null}
          {profile.yearsExperience !== null ? (
            <div>
              <dt>Experience</dt>
              <dd>{formatYears(profile.yearsExperience)}</dd>
            </div>
          ) : null}
        </dl>

        {profile.summaryExcerpt ? (
          <p className="profile-card__summary">{profile.summaryExcerpt}</p>
        ) : null}

        {profile.matches.length > 0 ? (
          <p className="profile-card__match">
            <span>Matched in</span>{' '}
            {profile.matches.map((match) => matchFieldLabel(match.field)).join(' · ')}
          </p>
        ) : null}

        {evidence.length > 0 ? (
          <ul className="profile-card__evidence" aria-label="Why this result matched">
            {evidence.map((match) => (
              <li key={match.field}>
                <strong>{matchFieldLabel(match.field)}:</strong>{' '}
                <span>“{match.excerpt}”</span>
              </li>
            ))}
          </ul>
        ) : null}

        {profile.skills.length > 0 ? (
          <ul
            className="skill-list"
            id={skillsId}
            aria-label={`${profile.fullName} skills`}
          >
            {visibleSkills.map((skill) => (
              <li
                className={
                  matchedSkills.has(skill)
                    ? 'skill-list__item--matched'
                    : undefined
                }
                key={skill}
              >
                {matchedSkills.has(skill) ? (
                  <span className="visually-hidden">Matched skill: </span>
                ) : null}
                {skill}
              </li>
            ))}
          </ul>
        ) : null}
        {hiddenSkillCount > 0 ? (
          <button
            aria-controls={skillsId}
            aria-expanded={showAllSkills}
            className="profile-card__skills-toggle"
            onClick={() => setShowAllSkills((current) => !current)}
            type="button"
          >
            {showAllSkills
              ? 'Show fewer skills'
              : `Show ${hiddenSkillCount} more skills`}
          </button>
        ) : null}
      </div>
    </article>
  );
}

const MATCH_FIELD_LABELS: Record<ProfileMatchField, string> = {
  name: 'name',
  title: 'title',
  skills: 'skills',
  company: 'company',
  industry: 'industry',
  summary: 'summary',
  experience: 'experience',
  education: 'education',
};

function matchFieldLabel(field: ProfileMatchField): string {
  return MATCH_FIELD_LABELS[field];
}

function formatYears(years: number): string {
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(years);
  return `${formatted} ${years === 1 ? 'year' : 'years'}`;
}

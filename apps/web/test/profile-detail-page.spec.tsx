import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { ProfileDetailPage } from '../src/features/profiles/profile-detail-page';
import type { ProfileDetail } from '../src/api/contracts';

const profile: ProfileDetail = {
  id: '00000000-0000-4000-8000-000000000001',
  fullName: 'Nika Rahimi',
  jobTitle: 'Senior Software Engineer',
  companyName: 'Example Labs',
  industry: 'Software',
  location: 'Tehran, Iran',
  country: 'Iran',
  summary: 'Builds reliable search and data platforms.',
  yearsExperience: 8.5,
  skills: ['Docker', 'Elasticsearch', 'PostgreSQL', 'TypeScript'],
  experience: [
    {
      jobTitle: 'Senior Software Engineer',
      companyName: 'Example Labs',
      location: 'Tehran, Iran',
      startDate: '2017-01',
      endDate: null,
      isCurrent: true,
      description: 'Builds reliable search platforms.',
    },
  ],
  education: [
    {
      institution: 'Synthetic Technical University',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Computer Science',
      startYear: 2012,
      endYear: 2016,
    },
  ],
  linkedinUrl: 'https://www.linkedin.com/in/synthetic-nika-rahimi',
};

describe('profile detail page', () => {
  it('shows the complete professional record and preserves the search return path', async () => {
    window.history.replaceState(
      null,
      '',
      `/profiles/${profile.id}?returnTo=${encodeURIComponent('/?q=python&page=2')}`,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(profile), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    render(
      <QueryClientProvider client={client}>
        <ProfileDetailPage id={profile.id} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Nika Rahimi' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Skills (4)' })).toBeInTheDocument();
    expect(screen.getByText('Builds reliable search platforms.')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Technical University')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Back to search' })).toHaveAttribute(
      'href',
      '/?q=python&page=2',
    );
  });
});

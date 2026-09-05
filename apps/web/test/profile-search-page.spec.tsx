import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileSearchPage } from '../src/features/search/profile-search-page';
import type { ProfileCard, ProfileSearchResponse } from '../src/api/contracts';

const profile: ProfileCard = {
  id: '00000000-0000-4000-8000-000000000001',
  fullName: 'Nika Rahimi',
  jobTitle: 'Senior Software Engineer',
  companyName: 'Example Labs',
  location: 'Tehran, Iran',
  country: 'Iran',
  yearsExperience: 8.5,
  skills: ['TypeScript', 'PostgreSQL'],
  matchedSkills: [],
  matches: [],
  summaryExcerpt: 'Builds reliable search platforms.',
  linkedinUrl: 'https://www.linkedin.com/in/synthetic-nika-rahimi',
};

function response(
  items = [profile],
  overrides: Partial<ProfileSearchResponse['meta']> = {},
): ProfileSearchResponse {
  return {
    items,
    meta: {
      page: 1,
      pageSize: 20,
      total: items.length,
      totalPages: items.length ? 1 : 0,
      tookMs: 3,
      ...overrides,
    },
    facets: {
      skills: [{ value: 'typescript', count: 1, selected: false }],
      locations: [{ value: 'tehran, iran', count: 1, selected: false }],
    },
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retryDelay: 0, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProfileSearchPage />
    </QueryClientProvider>,
  );
}

describe('profile search page', () => {
  it('shows stable loading geometry and then results', async () => {
    let finish: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    renderPage();
    expect(screen.getByLabelText('Loading profiles')).toBeInTheDocument();
    finish?.(json(response()));
    expect(await screen.findByText('Nika Rahimi')).toBeInTheDocument();
    expect(screen.getByText('1 profile')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute(
      'href',
      `/profiles/${profile.id}?returnTo=%2F`,
    );
  });

  it('explains keyword matches and discloses hidden skill count', async () => {
    window.history.replaceState(null, '', '/?q=python');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          json(
            response([
              {
                ...profile,
                skills: [
                  'Python',
                  'TypeScript',
                  ...Array.from(
                    { length: 12 },
                    (_, index) => `Skill ${index + 3}`,
                  ),
                ],
                matchedSkills: ['Python'],
                matches: [
                  { field: 'skills', excerpt: null },
                  {
                    field: 'experience',
                    excerpt: 'Built Python services for analytics teams.',
                  },
                ],
              },
            ]),
          ),
        ),
      ),
    );

    renderPage();

    expect(await screen.findByText(/skills · experience/u)).toHaveTextContent(
      'Matched in skills · experience',
    );
    expect(screen.getByText('Python')).toHaveClass('skill-list__item--matched');
    expect(
      screen.getByText('“Built Python services for analytics teams.”'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Skill 14')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Show 2 more skills' }),
    );
    expect(screen.getByText('Skill 14')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show fewer skills' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('offers recovery from an empty filtered search', async () => {
    window.history.replaceState(null, '', '/?q=missing');
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      return Promise.resolve(
        json(url.includes('q=missing') ? response([]) : response()),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    expect(await screen.findByText('Try a wider search.')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Clear all filters' }),
    );
    expect(await screen.findByText('Nika Rahimi')).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('shows an error and retries explicitly', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(json(response()));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    expect(
      await screen.findByRole('alert', {}, { timeout: 5_000 }),
    ).toHaveTextContent('We couldn’t load profiles.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Nika Rahimi')).toBeInTheDocument();
  });

  it('commits pagination to the URL and preserves controls', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const page = new URL(String(input), 'http://localhost').searchParams.get(
        'page',
      );
      return Promise.resolve(
        json(
          response([profile], { page: Number(page), total: 21, totalPages: 2 }),
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    expect(await screen.findByText('Nika Rahimi')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(window.location.search).toContain('page=2'));
    expect(screen.getByLabelText('Search profiles')).toBeInTheDocument();
  });
});

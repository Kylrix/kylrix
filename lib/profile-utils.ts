export interface NormalizedProfileLink {
  title: string;
  url: string;
  type?: 'website' | 'github' | 'twitter' | 'telegram' | 'linkedin' | 'custom';
}

export interface NormalizedProfile {
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  website: string | null;
  location: string | null;
  walletAddress: string | null;
  tags: string[];
  links: NormalizedProfileLink[];
  socials: {
    github?: string | null;
    twitter?: string | null;
    telegram?: string | null;
    linkedin?: string | null;
    website?: string | null;
  };
  createdAt?: string | null;
}

export function extractNormalizedProfile(profile: any): NormalizedProfile {
  if (!profile) {
    return {
      displayName: 'Kylrix User',
      username: '',
      bio: '',
      avatarUrl: null,
      bannerUrl: null,
      website: null,
      location: null,
      walletAddress: null,
      tags: [],
      links: [],
      socials: {},
    };
  }

  let prefs: any = {};
  if (typeof profile.preferences === 'string') {
    try {
      prefs = JSON.parse(profile.preferences) || {};
    } catch {}
  } else if (profile.preferences && typeof profile.preferences === 'object') {
    prefs = profile.preferences;
  }

  let socialLinksObj: any = {};
  if (typeof profile.socialLinks === 'string') {
    try {
      socialLinksObj = JSON.parse(profile.socialLinks) || {};
    } catch {}
  } else if (profile.socialLinks && typeof profile.socialLinks === 'object') {
    socialLinksObj = profile.socialLinks;
  } else if (profile.socials && typeof profile.socials === 'object') {
    socialLinksObj = profile.socials;
  }

  let metadataObj: any = {};
  if (typeof profile.metadata === 'string') {
    try {
      metadataObj = JSON.parse(profile.metadata) || {};
    } catch {}
  } else if (profile.metadata && typeof profile.metadata === 'object') {
    metadataObj = profile.metadata;
  }

  const website =
    profile.website ||
    prefs.website ||
    socialLinksObj.website ||
    null;

  const location =
    prefs.location ||
    metadataObj.location ||
    profile.location ||
    null;

  const walletAddress =
    profile.walletAddress ||
    prefs.walletAddress ||
    null;

  const rawTags = Array.isArray(prefs.tags)
    ? prefs.tags
    : (Array.isArray(profile.tags) ? profile.tags : []);

  const tags: string[] = rawTags.filter((t: any) => typeof t === 'string' && t.trim().length > 0);

  // Socials
  const github = socialLinksObj.github || prefs.github || null;
  const twitter = socialLinksObj.twitter || socialLinksObj.x || prefs.twitter || prefs.x || null;
  const telegram = socialLinksObj.telegram || prefs.telegram || null;
  const linkedin = socialLinksObj.linkedin || prefs.linkedin || null;

  const socials = {
    github,
    twitter,
    telegram,
    linkedin,
    website: website || socialLinksObj.website || null,
  };

  // Compile all links
  const links: NormalizedProfileLink[] = [];

  // Website link
  if (website) {
    const cleanUrl = website.startsWith('http') ? website : `https://${website}`;
    links.push({
      title: 'Website',
      url: cleanUrl,
      type: 'website',
    });
  }

  // GitHub link
  if (github) {
    const url = github.startsWith('http') ? github : `https://github.com/${github.replace(/^@/, '')}`;
    links.push({
      title: 'GitHub',
      url,
      type: 'github',
    });
  }

  // Twitter/X link
  if (twitter) {
    const handle = twitter.replace(/^@/, '').replace(/^https?:\/\/(x|twitter)\.com\//, '');
    links.push({
      title: 'X / Twitter',
      url: `https://x.com/${handle}`,
      type: 'twitter',
    });
  }

  // Telegram link
  if (telegram) {
    const handle = telegram.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
    links.push({
      title: 'Telegram',
      url: `https://t.me/${handle}`,
      type: 'telegram',
    });
  }

  // LinkedIn link
  if (linkedin) {
    const url = linkedin.startsWith('http') ? linkedin : `https://linkedin.com/in/${linkedin}`;
    links.push({
      title: 'LinkedIn',
      url,
      type: 'linkedin',
    });
  }

  // Custom Links
  const customLinks = Array.isArray(prefs.links)
    ? prefs.links
    : (Array.isArray(profile.links) ? profile.links : []);

  for (const item of customLinks) {
    if (!item) continue;
    if (typeof item === 'string' && item.trim().length > 0) {
      const url = item.startsWith('http') ? item : `https://${item}`;
      links.push({
        title: item.replace(/^https?:\/\//, '').replace(/\/$/, ''),
        url,
        type: 'custom',
      });
    } else if (typeof item === 'object' && item.url) {
      const url = item.url.startsWith('http') ? item.url : `https://${item.url}`;
      links.push({
        title: item.title || item.url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
        url,
        type: 'custom',
      });
    }
  }

  // Deduplicate links by URL
  const uniqueLinks: NormalizedProfileLink[] = [];
  const seenUrls = new Set<string>();
  for (const l of links) {
    const normUrl = l.url.toLowerCase().replace(/\/$/, '');
    if (!seenUrls.has(normUrl)) {
      seenUrls.add(normUrl);
      uniqueLinks.push(l);
    }
  }

  return {
    displayName: profile.displayName || profile.name || profile.username || 'Kylrix User',
    username: profile.username || '',
    bio: profile.bio || '',
    avatarUrl: profile.avatar || profile.avatarUrl || null,
    bannerUrl: profile.bannerUrl || null,
    website,
    location,
    walletAddress,
    tags,
    links: uniqueLinks,
    socials,
    createdAt: profile.$createdAt || profile.createdAt || null,
  };
}

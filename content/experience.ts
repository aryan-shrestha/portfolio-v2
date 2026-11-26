/**
 * Experience and Licenses & certifications, copied from the owner's LinkedIn profile
 * (linkedin.com/in/aryanshrestha274, read 2026-11-25). Newest first. Facts only: change them
 * here when the profile changes, never by guessing.
 */

export type Role = {
  /** As LinkedIn lists it; not shown on the site (owner removed the titles). */
  title: string
  company: string
  /** "Mon YYYY"; end undefined = current role. */
  start: string
  end?: string
  location: string
  /** On-site / Remote / Hybrid, as LinkedIn lists it. */
  mode: string
  skills: string[]
}

export type Certification = {
  name: string
  issuer: string
  issued: string
  credentialId: string
  url: string
}

export const roles: Role[] = [
  {
    title: 'Software Engineer',
    company: 'Maitri Services',
    start: 'Oct 2026',
    location: 'Lalitpur, Nepal',
    mode: 'On-site',
    // from the owner (2026-11-25); LinkedIn lists none for this role
    skills: ['Python', 'FastAPI', 'Browser Automation', 'TypeScript', 'React', 'GCP'],
  },
  {
    title: 'Software Engineer',
    company: 'Data to Insights AI',
    start: 'Jun 2025',
    end: 'Sep 2026',
    location: 'Kathmandu, Nepal',
    mode: 'Remote',
    // from the owner (2026-11-25), replacing LinkedIn's list
    skills: ['Python', 'FastAPI', 'TypeScript', 'Next.js', 'NestJS', 'PostgreSQL', 'AWS'],
  },
  {
    title: 'Python Developer',
    company: 'Alpas Technology',
    start: 'May 2025',
    end: 'Apr 2026',
    location: 'Lalitpur, Nepal',
    mode: 'On-site',
    skills: ['PostgreSQL', 'Python', 'Django', 'Django REST Framework'],
  },
  {
    title: 'Python Developer',
    company: 'Omway Technologies',
    start: 'Jan 2024',
    end: 'Apr 2025',
    location: 'Kathmandu, Nepal',
    mode: 'On-site',
    skills: ['PostgreSQL', 'Django', 'Django REST Framework'],
  },
  {
    title: 'Jr. Python/Django Developer',
    company: 'Spices Research & Consulting',
    start: 'Dec 2022',
    end: 'Dec 2023',
    location: 'Lalitpur, Nepal',
    mode: 'On-site',
    skills: ['PostgreSQL', 'Django', 'Django REST Framework'],
  },
]

export const certifications: Certification[] = [
  {
    name: 'Hands-on Introduction to Linux Commands and Shell Scripting',
    issuer: 'IBM',
    issued: 'Sep 2024',
    credentialId: 'MU5VOY2K6S2D',
    url: 'https://www.coursera.org/account/accomplishments/records/MU5VOY2K6S2D',
  },
  {
    name: 'Django Web Framework',
    issuer: 'Meta',
    issued: 'Jun 2024',
    credentialId: 'PRHFRBR9AXCV',
    url: 'https://www.coursera.org/account/accomplishments/records/PRHFRBR9AXCV',
  },
  {
    name: 'Foundations of Web Development: CSS, Bootstrap, JS, React',
    issuer: 'Udemy',
    issued: 'May 2024',
    credentialId: 'UC-ba01727c-39ac-47ae-9430-4730899d5b1e',
    url: 'https://www.udemy.com/certificate/UC-ba01727c-39ac-47ae-9430-4730899d5b1e/',
  },
  {
    name: 'Become a Python Master',
    issuer: 'Programiz',
    issued: 'Mar 2024',
    credentialId: '93DBA2B828B3',
    url: 'https://programiz.pro/certificates/detail/93DBA2B828B3',
  },
]

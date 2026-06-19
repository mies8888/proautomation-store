// Core Lead Generation Engine
// Currently mocked. Designed to be swapped with a real API like Outscraper or Apify.

export interface LeadSearchQuery {
  industry: string;
  country: string;
  city: string;
  purpose: string;
  count?: number;
}

export interface GeneratedLead {
  companyName: string;
  websiteUrl: string | null;
  industry: string;
  country: string;
  city: string;
  contactEmail: string | null;
  phone: string | null;
  leadScore: number;
}

export async function generateLeads(query: LeadSearchQuery): Promise<GeneratedLead[]> {
  // Simulate network delay for realistic UX
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const results: GeneratedLead[] = [];
  const count = query.count || 5;

  for (let i = 1; i <= count; i++) {
    results.push({
      companyName: `${query.city} ${query.industry} ${i} LLC`,
      websiteUrl: `https://www.${query.city.toLowerCase().replace(/\s+/g, '')}${query.industry.toLowerCase().replace(/\s+/g, '')}${i}.com`,
      industry: query.industry,
      country: query.country,
      city: query.city,
      contactEmail: `contact@${query.city.toLowerCase().replace(/\s+/g, '')}${query.industry.toLowerCase().replace(/\s+/g, '')}${i}.com`,
      phone: `+1 555-010${i}`,
      leadScore: Math.floor(Math.random() * 40) + 60, // 60-100
    });
  }

  return results;
}

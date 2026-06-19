import { Lead } from '@prisma/client'

export interface WebsiteOptions {
  companyName?: string
  tagline?: string
  description?: string
  primaryColor?: string
  includeContactForm?: boolean
  includeBlog?: boolean
}

export async function generateWebsite(lead: Lead, options?: WebsiteOptions): Promise<string> {
  // Simulate AI generation time for a website
  await new Promise(resolve => setTimeout(resolve, 4000))

  const companyName = options?.companyName || lead.companyName || "Your Business"
  const industry = lead.industry || "Professional Services"
  const city = lead.city || "Your City"
  const phone = lead.phone || "1-800-555-0199"

  // Procedurally generated Tailwind HTML
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName} - Premium ${industry} in ${city}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="bg-slate-50 text-slate-900">
    
    <!-- Navigation -->
    <nav class="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-20 items-center">
                <div class="flex-shrink-0 flex items-center">
                    <span class="text-2xl font-extrabold text-blue-600 tracking-tight">${companyName}</span>
                </div>
                <div class="hidden md:flex space-x-8">
                    <a href="#services" class="text-slate-600 hover:text-blue-600 font-medium transition">Services</a>
                    <a href="#about" class="text-slate-600 hover:text-blue-600 font-medium transition">About</a>
                    <a href="#testimonials" class="text-slate-600 hover:text-blue-600 font-medium transition">Reviews</a>
                </div>
                <div class="hidden md:flex items-center">
                    <a href="tel:${phone}" class="bg-blue-600 text-white px-6 py-2.5 rounded-full font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                        Call Now: ${phone}
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <div class="relative bg-white overflow-hidden">
        <div class="max-w-7xl mx-auto">
            <div class="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32 pt-20 px-4 sm:px-6 lg:px-8">
                <main class="mt-10 mx-auto max-w-7xl sm:mt-12 md:mt-16 lg:mt-20 xl:mt-28">
                    <div class="sm:text-center lg:text-left">
                        <h1 class="text-4xl tracking-tight font-extrabold text-slate-900 sm:text-5xl md:text-6xl leading-tight">
                            <span class="block xl:inline">Top-Rated ${industry}</span>
                            <span class="block text-blue-600">in ${city}</span>
                        </h1>
                        <p class="mt-3 text-base text-slate-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                            We deliver premium, reliable, and professional ${industry.toLowerCase()} services to homes and businesses across ${city}. Fully licensed and insured.
                        </p>
                        <div class="mt-8 sm:flex sm:justify-center lg:justify-start gap-4">
                            <a href="#contact" class="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10 transition shadow-xl shadow-blue-200">
                                Get a Free Quote
                            </a>
                            <a href="#services" class="w-full flex items-center justify-center px-8 py-3 border-2 border-slate-200 text-base font-medium rounded-full text-slate-700 bg-white hover:bg-slate-50 md:py-4 md:text-lg md:px-10 transition mt-3 sm:mt-0">
                                View Services
                            </a>
                        </div>
                    </div>
                </main>
            </div>
        </div>
        <div class="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2 bg-slate-100 flex items-center justify-center">
            <div class="text-slate-400 font-medium">[ AI Generated Hero Image ]</div>
        </div>
    </div>

    <!-- Services Section -->
    <div id="services" class="py-24 bg-slate-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <h2 class="text-base font-semibold text-blue-600 tracking-wide uppercase">Expertise</h2>
                <p class="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                    Our Specialized Services
                </p>
            </div>

            <div class="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                <div class="pt-6">
                    <div class="flow-root bg-white rounded-xl px-6 pb-8 border border-slate-100 shadow-sm hover:shadow-md transition h-full">
                        <div class="-mt-6">
                            <div>
                                <span class="inline-flex items-center justify-center p-3 bg-blue-600 rounded-xl shadow-lg">
                                    <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </span>
                            </div>
                            <h3 class="mt-8 text-xl font-bold text-slate-900 tracking-tight">Emergency Support</h3>
                            <p class="mt-5 text-base text-slate-500 leading-relaxed">
                                24/7 rapid response for all your urgent needs. We arrive fully equipped to solve problems fast.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

</body>
</html>
  `.trim();

  return html;
}

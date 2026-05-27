import ServiceSubPage from '../../components/ServiceSubPage';
import type { ServiceGroup } from '../../components/ServiceSubPage';
import { Target, Layers, TrendingUp, Search, DollarSign, Share2, FileText, Megaphone, PieChart } from 'lucide-react';

const groups: ServiceGroup[] = [
  {
    items: [
      {
        icon: Target,
        title: 'Marketing Strategy',
        desc: 'Comprehensive marketing strategies aligned with your business objectives — combining market analysis, audience segmentation, and multi-channel planning for maximum impact.'
      },
      {
        icon: Layers,
        title: 'Holistic Marketing',
        desc: 'Integrated marketing approaches that unify all channels, touchpoints, and messaging into a cohesive brand experience that drives consistent engagement and growth.'
      },
      {
        icon: TrendingUp,
        title: 'SMO',
        desc: 'Social Media Optimization strategies that maximize your organic reach, boost engagement rates, and build an authentic community around your brand.'
      },
      {
        icon: Search,
        title: 'SEO',
        desc: 'Technical and on-page search engine optimization that drives organic visibility, improves rankings, and establishes long-term authority in your niche.'
      },
      {
        icon: DollarSign,
        title: 'Paid Advertising',
        desc: 'Strategic paid media campaigns across Google Ads, social platforms, and programmatic networks — optimized for ROAS and scalable growth.'
      },
      {
        icon: Share2,
        title: 'Social Media',
        desc: 'Full-service social media management including content creation, community management, influencer partnerships, and performance tracking across all platforms.'
      },
      {
        icon: FileText,
        title: 'Content',
        desc: 'Strategic content creation and distribution — from blog posts and whitepapers to video scripts and email campaigns that educate, engage, and convert.'
      },
      {
        icon: Megaphone,
        title: 'PR Services',
        desc: 'Public relations strategies that build brand credibility, manage reputation, and secure media coverage that amplifies your brand presence in the market.'
      },
      {
        icon: PieChart,
        title: 'Data Analytics & Reporting',
        desc: 'Comprehensive analytics and reporting that translate raw data into actionable insights — tracking KPIs, measuring ROI, and informing strategic decisions.'
      }
    ]
  }
];

const Marketing = () => (
  <ServiceSubPage
    title="Marketing"
    subtitle="Get a full overview of our marketing services"
    groups={groups}
  />
);

export default Marketing;

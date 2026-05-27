import ServiceSubPage from '../../components/ServiceSubPage';
import type { ServiceGroup } from '../../components/ServiceSubPage';
import { Lightbulb, Brain, BarChart, ShieldCheck, FileCheck, CreditCard, Package } from 'lucide-react';

const groups: ServiceGroup[] = [
  {
    items: [
      {
        icon: Lightbulb,
        title: 'Digital Transformation',
        desc: 'Strategic roadmaps to modernize your business operations, migrate legacy systems, and adopt cutting-edge digital tools that drive efficiency and competitive advantage.'
      },
      {
        icon: Brain,
        title: 'AI Consultancy',
        desc: 'Expert guidance on integrating artificial intelligence into your business — from machine learning strategy to implementation of predictive analytics and automation workflows.'
      },
      {
        icon: BarChart,
        title: 'Market Research',
        desc: 'Data-driven market analysis, competitive intelligence, and consumer insights that inform your business strategy and help identify untapped growth opportunities.'
      },
      {
        icon: ShieldCheck,
        title: 'Data Protection & GDPR',
        desc: 'Comprehensive data protection strategies and GDPR compliance frameworks, ensuring your business meets regulatory requirements while safeguarding customer trust.'
      },
      {
        icon: FileCheck,
        title: 'ISO & Compliance',
        desc: 'End-to-end ISO certification support and regulatory compliance consulting, helping your organization meet international quality and security standards.'
      },
      {
        icon: CreditCard,
        title: 'PCI DSS',
        desc: 'Payment Card Industry Data Security Standard compliance consulting — protecting cardholder data and ensuring secure payment processing across all channels.'
      },
      {
        icon: Package,
        title: 'Product',
        desc: 'Product strategy and lifecycle management consulting — from ideation and MVP development to market fit analysis and scaling strategies.'
      }
    ]
  }
];

const Consultancy = () => (
  <ServiceSubPage
    title="Consultancy"
    subtitle="Get a full overview of our consultancy services"
    groups={groups}
  />
);

export default Consultancy;

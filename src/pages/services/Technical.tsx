import ServiceSubPage from '../../components/ServiceSubPage';
import type { ServiceGroup } from '../../components/ServiceSubPage';
import { Server, Cloud, Shield, Box, Layers } from 'lucide-react';

const groups: ServiceGroup[] = [
  {
    items: [
      {
        icon: Server,
        title: 'Managed IT Services',
        desc: 'Comprehensive IT infrastructure management — proactive monitoring, maintenance, helpdesk support, and strategic IT planning to keep your operations running smoothly.'
      },
      {
        icon: Cloud,
        title: 'Cloud Services',
        desc: 'Cloud migration, architecture design, and managed cloud solutions across AWS, Azure, and GCP — optimizing performance, security, and cost efficiency.'
      },
      {
        icon: Shield,
        title: 'Cyber Security',
        desc: 'Enterprise-grade security solutions including threat detection, penetration testing, vulnerability assessments, and incident response to protect your digital assets.'
      },
      {
        icon: Box,
        title: 'SaaS',
        desc: 'Custom SaaS product development from concept to deployment — scalable, multi-tenant architectures with subscription management and analytics built in.'
      },
      {
        icon: Layers,
        title: 'PaaS',
        desc: 'Platform-as-a-Service solutions that provide development environments, deployment pipelines, and infrastructure automation for faster time-to-market.'
      }
    ]
  }
];

const Technical = () => (
  <ServiceSubPage
    title="Technical"
    subtitle="Get a full overview of our technical services"
    groups={groups}
  />
);

export default Technical;

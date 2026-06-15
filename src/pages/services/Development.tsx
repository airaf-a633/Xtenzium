import ServiceSubPage from '../../components/ServiceSubPage';
import type { ServiceGroup } from '../../components/ServiceSubPage';
import { Code, Monitor, ShoppingCart, Smartphone, Wrench, Users, TestTube, Globe, ShoppingBag } from 'lucide-react';

const groups: ServiceGroup[] = [
  {
    items: [
      {
        icon: Code,
        title: 'Web Development',
        desc: 'High-performance, scalable web applications built with modern frameworks — React, Next.js, Node.js — tailored to your exact business requirements.'
      },
      {
        icon: Monitor,
        title: 'Software Development',
        desc: 'Custom software solutions engineered for complex business challenges — from enterprise platforms to internal tools, built with clean architecture and scalability in mind.'
      },
      {
        icon: ShoppingCart,
        title: 'eCommerce',
        desc: 'End-to-end eCommerce solutions — custom storefronts, payment integration, inventory management, and conversion-optimized shopping experiences.'
      },
      {
        icon: Smartphone,
        title: 'App Development',
        desc: 'Native and cross-platform mobile application development for iOS and Android — from concept and UX design through development, testing, and launch.'
      },
      {
        icon: Wrench,
        title: 'Support & Maintenance',
        desc: 'Ongoing technical support, performance monitoring, security patches, and feature enhancements to keep your applications running at peak performance.'
      },
      {
        icon: Users,
        title: 'Outsourced Development',
        desc: 'Dedicated development teams that integrate seamlessly with your workflow — providing flexible, scalable engineering capacity without the overhead.'
      },
      {
        icon: TestTube,
        title: 'Testing',
        desc: 'Comprehensive QA and testing services — automated testing, manual testing, performance testing, and security auditing to ensure bulletproof software quality.'
      }
    ]
  },
  {
    groupTitle: 'Platforms',
    items: [
      {
        icon: Globe,
        title: 'WordPress',
        desc: 'Custom WordPress development — themes, plugins, WooCommerce integration, performance optimization, and enterprise-scale WordPress solutions.'
      },
      {
        icon: ShoppingBag,
        title: 'Shopify',
        desc: 'Shopify store development and customization — custom themes, app integrations, Shopify Plus solutions, and migration services.'
      }
    ]
  }
];

const Development = () => (
  <ServiceSubPage
    title="Development"
    subtitle="Get a full overview of our development services"
    groups={groups}
  />
);

export default Development;

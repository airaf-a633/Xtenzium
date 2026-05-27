import ServiceSubPage from '../../components/ServiceSubPage';
import type { ServiceGroup } from '../../components/ServiceSubPage';
import { Monitor, Palette, Star, Film, Scissors } from 'lucide-react';

const groups: ServiceGroup[] = [
  {
    items: [
      {
        icon: Monitor,
        title: 'Web Design',
        desc: 'Custom website designs that blend stunning aesthetics with intuitive UX — creating digital experiences that captivate visitors and drive conversions.'
      },
      {
        icon: Palette,
        title: 'Graphic Design',
        desc: 'Professional graphic design services spanning marketing collateral, digital assets, illustrations, and visual content that reinforces your brand identity.'
      },
      {
        icon: Star,
        title: 'Branding',
        desc: 'Complete brand identity development — from logo design and visual systems to brand guidelines and positioning strategy that sets you apart in the market.'
      },
      {
        icon: Film,
        title: 'Production',
        desc: 'Full-scale content production including photography, videography, motion graphics, and multimedia assets that tell your brand story with cinematic quality.'
      },
      {
        icon: Scissors,
        title: 'Video Editing',
        desc: 'Professional video editing and post-production services — color grading, sound design, motion graphics, and final delivery optimized for every platform.'
      }
    ]
  }
];

const Design = () => (
  <ServiceSubPage
    title="Design"
    subtitle="Get a full overview of our design services"
    groups={groups}
  />
);

export default Design;

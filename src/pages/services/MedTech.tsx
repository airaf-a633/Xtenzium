import ServiceSubPage from '../../components/ServiceSubPage';
import type { ServiceGroup } from '../../components/ServiceSubPage';
import { Stethoscope, Monitor, Shield, Link2, TestTube } from 'lucide-react';

const groups: ServiceGroup[] = [
  {
    items: [
      {
        icon: Link2,
        title: 'Medical Device Connectivity',
        desc: 'Seamless integration of medical devices with software systems, enabling real-time data exchange, remote monitoring, and interoperability across healthcare networks.'
      },
      {
        icon: Monitor,
        title: 'Medical Software Development',
        desc: 'Custom-built software solutions for healthcare — from patient management systems to clinical decision support tools, all compliant with medical industry standards.'
      },
      {
        icon: Stethoscope,
        title: 'Healthcare Integrated Systems',
        desc: 'End-to-end integration of disparate healthcare platforms, ensuring unified data flow between EHR, lab systems, imaging, and administrative workflows.'
      },
      {
        icon: Shield,
        title: 'Healthcare Cyber Security',
        desc: 'Comprehensive security frameworks protecting sensitive patient data, ensuring HIPAA compliance, and defending against evolving cyber threats in healthcare environments.'
      },
      {
        icon: TestTube,
        title: 'Healthcare Software Testing',
        desc: 'Rigorous QA and validation testing for medical software, ensuring reliability, regulatory compliance, and flawless performance in mission-critical healthcare applications.'
      }
    ]
  }
];

const MedTech = () => (
  <ServiceSubPage
    title="MedTech"
    subtitle="Get a full overview of our medtech services"
    groups={groups}
  />
);

export default MedTech;

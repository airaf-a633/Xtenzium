import ServiceSubPage from '../../components/ServiceSubPage';
import type { ServiceGroup } from '../../components/ServiceSubPage';
import {
  Home, Factory, Cloud, BarChart, Wifi,
  Cpu, Clock, Microchip, HardDrive, Terminal,
  CircuitBoard, PenTool, Wrench, Bug, Zap,
  Bluetooth, Radio, MessageSquare, Signal,
  Server, Globe, Router, Database, RefreshCw,
  Stethoscope, Car, Leaf, BatteryCharging
} from 'lucide-react';

const groups: ServiceGroup[] = [
  {
    groupTitle: 'IoT Solutions',
    items: [
      {
        icon: Home,
        title: 'Smart Home/Building Automation',
        desc: 'Intelligent automation systems for residential and commercial spaces — lighting, HVAC, security, and energy management controlled through unified IoT platforms.'
      },
      {
        icon: Factory,
        title: 'Industrial IoT',
        desc: 'Robust IIoT solutions for manufacturing and industrial environments — predictive maintenance, asset tracking, process optimization, and real-time monitoring.'
      },
      {
        icon: Cloud,
        title: 'IoT Cloud Integration',
        desc: 'Seamless integration of IoT devices with cloud platforms, enabling scalable data processing, analytics, and remote management of distributed device fleets.'
      },
      {
        icon: BarChart,
        title: 'IoT Dashboard & Monitoring',
        desc: 'Real-time dashboards and monitoring systems that visualize sensor data, trigger alerts, and provide actionable insights from your connected device ecosystem.'
      },
      {
        icon: Wifi,
        title: 'Wireless Sensor Networks',
        desc: 'Design and deployment of wireless sensor networks for environmental monitoring, data collection, and distributed sensing across large-scale installations.'
      }
    ]
  },
  {
    groupTitle: 'Embedded Systems',
    items: [
      {
        icon: Cpu,
        title: 'Embedded Firmware Development',
        desc: 'Custom firmware development for microcontrollers and embedded processors — optimized for performance, power efficiency, and reliability in resource-constrained environments.'
      },
      {
        icon: Clock,
        title: 'RTOS',
        desc: 'Real-Time Operating System development and integration — FreeRTOS, Zephyr, and custom RTOS solutions for time-critical embedded applications.'
      },
      {
        icon: Microchip,
        title: 'Microcontroller Programming',
        desc: 'Expert programming across ARM Cortex, ESP32, STM32, AVR, and PIC microcontroller families — bare-metal and HAL-based development.'
      },
      {
        icon: HardDrive,
        title: 'Device Driver Development',
        desc: 'Custom device drivers for peripherals, sensors, and communication interfaces — ensuring reliable hardware-software interaction at the lowest level.'
      },
      {
        icon: Terminal,
        title: 'Boot-loader Development',
        desc: 'Custom bootloader design and implementation for secure boot, firmware updates, and multi-stage initialization of embedded systems.'
      }
    ]
  },
  {
    groupTitle: 'Hardware & Electronics',
    items: [
      {
        icon: CircuitBoard,
        title: 'PCB Design & Layout',
        desc: 'Professional PCB design from schematic to manufacturing-ready Gerber files — multi-layer boards, RF layout, and high-speed signal integrity optimization.'
      },
      {
        icon: PenTool,
        title: 'Schematic Design',
        desc: 'Detailed electronic schematic design with component selection, power architecture planning, and design-for-manufacturability considerations.'
      },
      {
        icon: Wrench,
        title: 'Prototype Development',
        desc: 'Rapid prototyping from concept to working hardware — 3D printing, PCB fabrication, assembly, and iterative testing for product validation.'
      },
      {
        icon: Bug,
        title: 'Hardware Testing & Debugging',
        desc: 'Comprehensive hardware testing — oscilloscope analysis, signal integrity testing, thermal profiling, and systematic debugging of complex electronic systems.'
      },
      {
        icon: Zap,
        title: 'Circuit Design',
        desc: 'Analog and digital circuit design — power supplies, signal conditioning, amplifiers, filters, and mixed-signal systems tailored to your specifications.'
      }
    ]
  },
  {
    groupTitle: 'Connectivity',
    items: [
      {
        icon: Bluetooth,
        title: 'Bluetooth/BLE',
        desc: 'Bluetooth Classic and BLE solution development — custom profiles, GATT services, mesh networking, and ultra-low-power wireless communication.'
      },
      {
        icon: Radio,
        title: 'WiFi/Zigbee/LoRa',
        desc: 'Multi-protocol wireless solutions covering WiFi, Zigbee mesh networks, and LoRa/LoRaWAN for long-range, low-power IoT connectivity.'
      },
      {
        icon: MessageSquare,
        title: 'MQTT/CoAP',
        desc: 'Lightweight messaging protocol implementation — MQTT brokers, CoAP endpoints, and efficient machine-to-machine communication for constrained networks.'
      },
      {
        icon: Signal,
        title: '4G/5G IoT Modules',
        desc: 'Cellular IoT integration using LTE-M, NB-IoT, and 5G modules — enabling wide-area connectivity for mobile and remote IoT deployments.'
      }
    ]
  },
  {
    groupTitle: 'IoT Cloud',
    items: [
      {
        icon: Server,
        title: 'AWS IoT',
        desc: 'AWS IoT Core integration — device provisioning, shadow management, rules engine configuration, and serverless data processing pipelines.'
      },
      {
        icon: Globe,
        title: 'Azure IoT',
        desc: 'Azure IoT Hub and Edge solutions — device management, stream analytics, digital twins, and enterprise-grade IoT platform deployment.'
      },
      {
        icon: Router,
        title: 'IoT Gateway',
        desc: 'Custom IoT gateway development — protocol translation, edge computing, local data processing, and secure cloud connectivity for device fleets.'
      },
      {
        icon: Database,
        title: 'Data Logging',
        desc: 'Efficient data logging and storage solutions — time-series databases, data compression, buffering strategies, and reliable data persistence for IoT systems.'
      },
      {
        icon: RefreshCw,
        title: 'OTA Updates',
        desc: 'Over-the-air firmware update infrastructure — secure delivery, differential updates, rollback mechanisms, and fleet-wide deployment management.'
      }
    ]
  },
  {
    groupTitle: 'Industry Solutions',
    items: [
      {
        icon: Stethoscope,
        title: 'Medical IoT',
        desc: 'Connected health solutions — remote patient monitoring, wearable medical devices, and IoT-enabled diagnostics meeting healthcare regulatory standards.'
      },
      {
        icon: Car,
        title: 'Automotive Embedded',
        desc: 'Automotive-grade embedded systems — CAN bus communication, ADAS components, telematics, and in-vehicle infotainment system development.'
      },
      {
        icon: Leaf,
        title: 'Agricultural IoT',
        desc: 'Smart agriculture solutions — precision farming sensors, automated irrigation, crop monitoring, and environmental data analytics for optimized yields.'
      },
      {
        icon: BatteryCharging,
        title: 'Smart Energy',
        desc: 'Intelligent energy management systems — smart metering, grid monitoring, renewable energy integration, and demand-response automation.'
      }
    ]
  }
];

const IoT = () => (
  <ServiceSubPage
    title="IoT & Embedded Systems"
    subtitle="Beyond software, we build the physical layer"
    groups={groups}
  />
);

export default IoT;

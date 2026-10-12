import type { Diagram } from './diagram';
import systemContext from './diagrams/01-system-context';
import runSequence from './diagrams/02-run-sequence';
import replay from './diagrams/03-replay-verification';
import relicTrust from './diagrams/04-relic-trust';
import clientArchitecture from './diagrams/05-client-architecture';
import dataModel from './diagrams/06-data-model';
import deploymentMap from './diagrams/07-deployment-map';

export const ALL_DIAGRAMS: readonly Diagram[] = [systemContext, runSequence, replay, relicTrust, clientArchitecture, dataModel, deploymentMap];

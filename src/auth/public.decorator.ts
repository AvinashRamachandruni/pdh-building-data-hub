import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const IS_LOCAL_RDF_EVALUATION_KEY = 'isLocalRdfEvaluation';
export const LocalRdfEvaluationOnly = () =>
	SetMetadata(IS_LOCAL_RDF_EVALUATION_KEY, true);
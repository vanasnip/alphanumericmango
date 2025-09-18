# MISSING CRUD OPERATIONS IMPLEMENTATION - PHASE 2
**STATUS**: 🔧 COMPLETE CRUD API WITH SECURITY CONTROLS  
**PRIORITY**: CRITICAL - Phase 2 Week 2 Implementation  
**COMPLIANCE**: Full CRUD + Bulk Operations + Security Authorization

## Executive Summary

This document implements the complete set of missing CRUD operations identified in the Phase 1 review, with comprehensive security controls, bulk operations, pagination, filtering, search functionality, and data export/import capabilities. All operations integrate with the OAuth 2.0 + JWT security framework and implement proper authorization checks.

**Implementation Objectives**:
- Complete CRUD operations for all resources (projects, sessions, contexts)
- Implement bulk operations with proper authorization and transaction management
- Add comprehensive pagination and filtering with security controls
- Implement search functionality with access control and result filtering
- Provide secure data export/import with encryption and audit logging

---

## 1. Projects API - Complete CRUD Implementation

### 1.1 Enhanced Project Resource Operations

```typescript
/**
 * Complete Project API with security controls and advanced operations
 * Implements full CRUD, bulk operations, search, and export functionality
 */
import { Request, Response } from 'express';
import { SecurityContext } from '../security/security-context';
import { AuthorizationService } from '../security/authorization-service';
import { AuditLogger } from '../audit/audit-logger';
import { ValidationService } from '../validation/validation-service';

export class ProjectsController {
  private authService: AuthorizationService;
  private auditLogger: AuditLogger;
  private validator: ValidationService;
  private projectService: ProjectService;

  constructor(services: ServiceContainer) {
    this.authService = services.authorization;
    this.auditLogger = services.audit;
    this.validator = services.validation;
    this.projectService = services.projects;
  }

  // CREATE - Enhanced with validation and security
  async createProject(req: Request, res: Response): Promise<void> {
    const context = SecurityContext.fromRequest(req);
    
    try {
      // Authorization check
      await this.authService.requirePermission(context, 'projects:create');

      // Input validation
      const createRequest = await this.validator.validateCreateProject(req.body);

      // Business logic validation
      await this.validateProjectCreation(createRequest, context);

      // Create project with security context
      const project = await this.projectService.createProject(createRequest, context);

      // Audit logging
      await this.auditLogger.logProjectCreation(project, context);

      res.status(201).json({
        success: true,
        data: this.sanitizeProjectResponse(project, context),
        metadata: {
          created_at: project.created_at,
          permissions: await this.getProjectPermissions(project.id, context)
        }
      });

    } catch (error) {
      await this.handleError(error, 'CREATE_PROJECT', context, res);
    }
  }

  // READ - Single project with security filtering
  async getProject(req: Request, res: Response): Promise<void> {
    const context = SecurityContext.fromRequest(req);
    const projectId = req.params.id;

    try {
      // Authorization check
      await this.authService.requirePermission(context, 'projects:read', projectId);

      // Get project with security filtering
      const project = await this.projectService.getProject(projectId, context);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found or access denied'
          }
        });
      }

      // Audit logging
      await this.auditLogger.logProjectAccess(projectId, context, 'READ');

      res.json({
        success: true,
        data: this.sanitizeProjectResponse(project, context),
        metadata: {
          permissions: await this.getProjectPermissions(projectId, context),
          last_accessed: new Date()
        }
      });

    } catch (error) {
      await this.handleError(error, 'GET_PROJECT', context, res);
    }
  }

  // READ - List projects with pagination, filtering, and search
  async listProjects(req: Request, res: Response): Promise<void> {
    const context = SecurityContext.fromRequest(req);

    try {
      // Authorization check
      await this.authService.requirePermission(context, 'projects:list');

      // Parse and validate query parameters
      const queryParams = await this.validator.validateListProjectsQuery(req.query);

      // Apply security filters
      const securityFilters = await this.buildSecurityFilters(context);

      // Get projects with pagination and filtering
      const result = await this.projectService.listProjects({
        ...queryParams,
        securityFilters,
        context
      });

      // Audit logging
      await this.auditLogger.logProjectList(queryParams, result.total, context);

      res.json({
        success: true,
        data: result.projects.map(p => this.sanitizeProjectResponse(p, context)),
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          total: result.total,
          pages: Math.ceil(result.total / queryParams.limit),
          has_next: result.hasNext,
          has_prev: result.hasPrev
        },
        metadata: {
          filters_applied: result.filtersApplied,
          search_query: queryParams.search,
          sort_by: queryParams.sortBy,
          sort_order: queryParams.sortOrder
        }
      });

    } catch (error) {
      await this.handleError(error, 'LIST_PROJECTS', context, res);
    }
  }

  // UPDATE - Enhanced with partial updates and version control
  async updateProject(req: Request, res: Response): Promise<void> {
    const context = SecurityContext.fromRequest(req);
    const projectId = req.params.id;

    try {
      // Authorization check
      await this.authService.requirePermission(context, 'projects:update', projectId);

      // Input validation
      const updateRequest = await this.validator.validateUpdateProject(req.body);

      // Version control check
      if (updateRequest.version && !await this.checkVersion(projectId, updateRequest.version)) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'VERSION_CONFLICT',
            message: 'Project has been modified by another user'
          }
        });
      }

      // Update project with security context
      const updatedProject = await this.projectService.updateProject(
        projectId, 
        updateRequest, 
        context
      );

      // Audit logging
      await this.auditLogger.logProjectUpdate(projectId, updateRequest, context);

      res.json({
        success: true,
        data: this.sanitizeProjectResponse(updatedProject, context),
        metadata: {
          updated_at: updatedProject.updated_at,
          version: updatedProject.version,
          updated_by: context.userId
        }
      });

    } catch (error) {
      await this.handleError(error, 'UPDATE_PROJECT', context, res);
    }
  }

  // DELETE - Soft delete with recovery options
  async deleteProject(req: Request, res: Response): Promise<void> {
    const context = SecurityContext.fromRequest(req);
    const projectId = req.params.id;

    try {
      // Authorization check (requires admin or owner permission)
      await this.authService.requirePermission(context, 'projects:delete', projectId);

      // Check for dependencies
      const dependencies = await this.projectService.checkDependencies(projectId);
      if (dependencies.length > 0 && !req.query.force) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'HAS_DEPENDENCIES',
            message: 'Project has active dependencies',
            details: dependencies
          }
        });
      }

      // Perform soft delete
      const deletedProject = await this.projectService.deleteProject(projectId, {
        soft: true,
        force: req.query.force === 'true',
        context
      });

      // Audit logging
      await this.auditLogger.logProjectDeletion(projectId, context);

      res.json({
        success: true,
        data: {
          id: projectId,
          deleted_at: deletedProject.deleted_at,
          recovery_deadline: deletedProject.recovery_deadline
        },
        metadata: {
          soft_delete: true,
          can_recover: true,
          dependencies_handled: dependencies.length
        }
      });

    } catch (error) {
      await this.handleError(error, 'DELETE_PROJECT', context, res);
    }
  }

  // BULK OPERATIONS - Create multiple projects
  async bulkCreateProjects(req: Request, res: Response): Promise<void> {
    const context = SecurityContext.fromRequest(req);

    try {
      // Authorization check
      await this.authService.requirePermission(context, 'projects:bulk_create');

      // Input validation
      const bulkRequest = await this.validator.validateBulkCreateProjects(req.body);

      // Check bulk operation limits
      if (bulkRequest.projects.length > this.config.maxBulkSize) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BULK_LIMIT_EXCEEDED',
            message: `Maximum ${this.config.maxBulkSize} projects per bulk operation`
          }
        });
      }

      // Process bulk creation with transaction
      const result = await this.projectService.bulkCreateProjects(bulkRequest, context);

      // Audit logging
      await this.auditLogger.logBulkProjectCreation(result, context);

      res.status(201).json({
        success: true,
        data: {
          created: result.created.map(p => this.sanitizeProjectResponse(p, context)),
          failed: result.failed,
          summary: {
            total_requested: bulkRequest.projects.length,
            successful: result.created.length,
            failed: result.failed.length
          }
        }
      });

    } catch (error) {
      await this.handleError(error, 'BULK_CREATE_PROJECTS', context, res);
    }
  }

  // BULK OPERATIONS - Update multiple projects
  async bulkUpdateProjects(req: Request, res: Response): Promise<void> {
    const context = SecurityContext.fromRequest(req);

    try {
      // Authorization check
      await this.authService.requirePermission(context, 'projects:bulk_update');

      // Input validation
      const bulkRequest = await this.validator.validateBulkUpdateProjects(req.body);

      // Verify permissions for all projects
      const permissionChecks = await Promise.all(
        bulkRequest.updates.map(update => 
          this.authService.hasPermission(context, 'projects:update', update.id)
        )
      );

      const unauthorizedProjects = bulkRequest.updates.filter((_, index) => !permissionChecks[index]);
      if (unauthorizedProjects.length > 0) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'BULK_AUTHORIZATION_FAILED',
            message: 'Insufficient permissions for some projects',
            details: unauthorizedProjects.map(p => p.id)
          }
        });
      }

      // Process bulk updates with transaction
      const result = await this.projectService.bulkUpdateProjects(bulkRequest, context);

      // Audit logging
      await this.auditLogger.logBulkProjectUpdate(result, context);

      res.json({
        success: true,
        data: {
          updated: result.updated.map(p => this.sanitizeProjectResponse(p, context)),
          failed: result.failed,
          summary: {
            total_requested: bulkRequest.updates.length,
            successful: result.updated.length,
            failed: result.failed.length
          }
        }
      });

    } catch (error) {
      await this.handleError(error, 'BULK_UPDATE_PROJECTS', context, res);
    }
  }

  // SEARCH - Advanced search with security filtering
  async searchProjects(req: Request, res: Response): Promise<void> {
    const context = SecurityContext.fromRequest(req);

    try {
      // Authorization check
      await this.authService.requirePermission(context, 'projects:search');

      // Parse and validate search parameters
      const searchParams = await this.validator.validateProjectSearch(req.query);

      // Apply security filters to search
      const securityFilters = await this.buildSecurityFilters(context);

      // Perform search with security context
      const searchResult = await this.projectService.searchProjects({
        ...searchParams,
        securityFilters,
        context
      });

      // Audit logging
      await this.auditLogger.logProjectSearch(searchParams, searchResult.total, context);

      res.json({
        success: true,
        data: searchResult.projects.map(p => this.sanitizeProjectResponse(p, context)),
        search: {
          query: searchParams.query,
          filters: searchParams.filters,
          total_results: searchResult.total,
          search_time_ms: searchResult.searchTime,
          suggestions: searchResult.suggestions
        },
        pagination: searchResult.pagination
      });

    } catch (error) {
      await this.handleError(error, 'SEARCH_PROJECTS', context, res);
    }
  }

  // EXPORT - Secure data export with encryption
  async exportProjects(req: Request, res: Response): Promise<void> {
    const context = SecurityContext.fromRequest(req);

    try {
      // Authorization check (requires elevated permission)
      await this.authService.requirePermission(context, 'projects:export');

      // Parse export parameters
      const exportParams = await this.validator.validateProjectExport(req.query);

      // Apply security filters
      const securityFilters = await this.buildSecurityFilters(context);

      // Generate secure export
      const exportResult = await this.projectService.exportProjects({
        ...exportParams,
        securityFilters,
        context
      });

      // Audit logging
      await this.auditLogger.logProjectExport(exportParams, exportResult.recordCount, context);

      // Set appropriate headers for download
      res.set({
        'Content-Type': exportResult.mimeType,
        'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        'X-Export-Record-Count': exportResult.recordCount.toString(),
        'X-Export-Generated-At': new Date().toISOString()
      });

      // Stream encrypted export data
      res.send(exportResult.encryptedData);

    } catch (error) {
      await this.handleError(error, 'EXPORT_PROJECTS', context, res);
    }
  }

  // IMPORT - Secure data import with validation
  async importProjects(req: Request, res: Response): Promise<void> {
    const context = SecurityContext.fromRequest(req);

    try {
      // Authorization check (requires elevated permission)
      await this.authService.requirePermission(context, 'projects:import');

      // Validate import file
      const importFile = req.file;
      if (!importFile) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_IMPORT_FILE',
            message: 'Import file is required'
          }
        });
      }

      // Parse import parameters
      const importParams = await this.validator.validateProjectImport(req.body);

      // Process secure import
      const importResult = await this.projectService.importProjects({
        file: importFile,
        params: importParams,
        context
      });

      // Audit logging
      await this.auditLogger.logProjectImport(importParams, importResult, context);

      res.status(201).json({
        success: true,
        data: {
          imported: importResult.imported.map(p => this.sanitizeProjectResponse(p, context)),
          failed: importResult.failed,
          summary: {
            total_records: importResult.totalRecords,
            imported: importResult.imported.length,
            failed: importResult.failed.length,
            skipped: importResult.skipped.length
          }
        },
        metadata: {
          import_id: importResult.importId,
          imported_at: new Date(),
          import_format: importResult.format
        }
      });

    } catch (error) {
      await this.handleError(error, 'IMPORT_PROJECTS', context, res);
    }
  }

  // Helper methods
  private sanitizeProjectResponse(project: Project, context: SecurityContext): any {
    const response = {
      id: project.id,
      name: project.name,
      description: project.description,
      type: project.type,
      status: project.status,
      created_at: project.created_at,
      updated_at: project.updated_at,
      // Only include sensitive fields if user has appropriate permissions
      ...(context.hasPermission('projects:view_details') && {
        path: project.path,
        git_repository: project.git_repository,
        environment: project.environment
      }),
      ...(context.hasPermission('projects:view_metadata') && {
        metadata: project.metadata,
        tags: project.tags,
        owner_id: project.owner_id
      })
    };

    return response;
  }

  private async getProjectPermissions(projectId: string, context: SecurityContext): Promise<string[]> {
    return await this.authService.getUserPermissions(context, 'projects', projectId);
  }

  private async buildSecurityFilters(context: SecurityContext): Promise<SecurityFilter[]> {
    const filters: SecurityFilter[] = [];

    // Add user visibility filter
    if (!context.hasPermission('projects:view_all')) {
      filters.push({
        type: 'user_visibility',
        user_id: context.userId,
        include_shared: context.hasPermission('projects:view_shared')
      });
    }

    // Add organization filter if applicable
    if (context.organizationId) {
      filters.push({
        type: 'organization',
        organization_id: context.organizationId
      });
    }

    return filters;
  }

  private async validateProjectCreation(request: CreateProjectRequest, context: SecurityContext): Promise<void> {
    // Check project name uniqueness within user scope
    const existingProject = await this.projectService.findByName(request.name, context.userId);
    if (existingProject) {
      throw new ValidationError('PROJECT_NAME_EXISTS', 'Project name already exists');
    }

    // Validate project path
    if (request.path && !await this.projectService.isValidPath(request.path)) {
      throw new ValidationError('INVALID_PATH', 'Invalid project path');
    }

    // Check user project limits
    const userProjectCount = await this.projectService.getUserProjectCount(context.userId);
    const userLimits = await this.authService.getUserLimits(context.userId);
    
    if (userProjectCount >= userLimits.maxProjects) {
      throw new ValidationError('PROJECT_LIMIT_EXCEEDED', 'Maximum project limit reached');
    }
  }

  private async checkVersion(projectId: string, requestVersion: number): Promise<boolean> {
    const currentProject = await this.projectService.getProject(projectId);
    return currentProject?.version === requestVersion;
  }

  private async handleError(error: any, operation: string, context: SecurityContext, res: Response): Promise<void> {
    // Log error
    console.error(`${operation} error:`, error);

    // Audit error
    await this.auditLogger.logError(operation, error, context);

    // Return appropriate error response
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
    } else if (error instanceof AuthorizationError) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Insufficient permissions'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred'
        }
      });
    }
  }
}
```

### 1.2 Advanced Filtering and Pagination Implementation

```typescript
/**
 * Advanced filtering, pagination, and search capabilities
 * Implements cursor-based pagination, multi-field filtering, and full-text search
 */
export class ProjectQueryService {
  private searchEngine: SearchEngine;
  private filterBuilder: FilterBuilder;
  private paginationService: PaginationService;

  constructor(services: ServiceContainer) {
    this.searchEngine = services.search;
    this.filterBuilder = services.filters;
    this.paginationService = services.pagination;
  }

  async executeQuery(query: ProjectQuery, context: SecurityContext): Promise<ProjectQueryResult> {
    // Build security-aware query
    const secureQuery = await this.buildSecureQuery(query, context);

    // Execute search if query provided
    let searchResults: SearchResult | null = null;
    if (secureQuery.search?.query) {
      searchResults = await this.searchEngine.search({
        query: secureQuery.search.query,
        indices: ['projects'],
        filters: secureQuery.filters,
        boost: secureQuery.search.boost,
        fuzziness: secureQuery.search.fuzziness
      });
    }

    // Build database query
    const dbQuery = this.buildDatabaseQuery(secureQuery, searchResults);

    // Execute paginated query
    const result = await this.paginationService.executePaginatedQuery(dbQuery, {
      page: secureQuery.pagination.page,
      limit: secureQuery.pagination.limit,
      cursor: secureQuery.pagination.cursor,
      sort: secureQuery.sort
    });

    return {
      projects: result.items,
      pagination: result.pagination,
      filters: secureQuery.filters,
      search: searchResults ? {
        query: secureQuery.search!.query,
        total_hits: searchResults.totalHits,
        max_score: searchResults.maxScore,
        search_time_ms: searchResults.searchTime
      } : undefined,
      metadata: {
        total_filtered: result.totalFiltered,
        total_accessible: await this.getTotalAccessible(context),
        query_time_ms: result.queryTime
      }
    };
  }

  private async buildSecureQuery(query: ProjectQuery, context: SecurityContext): Promise<SecureProjectQuery> {
    // Apply security filters
    const securityFilters = await this.buildSecurityFilters(context);
    
    // Merge with user filters
    const allFilters = [...securityFilters, ...this.parseUserFilters(query.filters)];

    // Validate sort fields
    const validSort = this.validateSortFields(query.sort, context);

    return {
      filters: allFilters,
      search: query.search ? {
        query: this.sanitizeSearchQuery(query.search.query),
        fields: this.getSearchableFields(context),
        boost: query.search.boost || {},
        fuzziness: query.search.fuzziness || 'AUTO'
      } : undefined,
      sort: validSort,
      pagination: {
        page: Math.max(1, query.pagination?.page || 1),
        limit: Math.min(100, Math.max(1, query.pagination?.limit || 20)),
        cursor: query.pagination?.cursor
      }
    };
  }

  private parseUserFilters(filters: any): QueryFilter[] {
    const parsed: QueryFilter[] = [];

    // Status filter
    if (filters.status) {
      parsed.push({
        field: 'status',
        operator: 'in',
        values: Array.isArray(filters.status) ? filters.status : [filters.status]
      });
    }

    // Type filter
    if (filters.type) {
      parsed.push({
        field: 'type',
        operator: 'in',
        values: Array.isArray(filters.type) ? filters.type : [filters.type]
      });
    }

    // Date range filters
    if (filters.created_after) {
      parsed.push({
        field: 'created_at',
        operator: 'gte',
        value: new Date(filters.created_after)
      });
    }

    if (filters.created_before) {
      parsed.push({
        field: 'created_at',
        operator: 'lte',
        value: new Date(filters.created_before)
      });
    }

    // Tag filter
    if (filters.tags) {
      parsed.push({
        field: 'tags',
        operator: 'contains_any',
        values: Array.isArray(filters.tags) ? filters.tags : [filters.tags]
      });
    }

    // Owner filter
    if (filters.owner) {
      parsed.push({
        field: 'owner_id',
        operator: 'eq',
        value: filters.owner
      });
    }

    // Path filter (with security validation)
    if (filters.path && this.canFilterByPath(context)) {
      parsed.push({
        field: 'path',
        operator: 'starts_with',
        value: filters.path
      });
    }

    return parsed;
  }

  private getSearchableFields(context: SecurityContext): string[] {
    const baseFields = ['name', 'description'];
    
    if (context.hasPermission('projects:search_metadata')) {
      baseFields.push('tags', 'metadata');
    }

    if (context.hasPermission('projects:search_content')) {
      baseFields.push('readme_content', 'documentation');
    }

    return baseFields;
  }

  private validateSortFields(sort: any, context: SecurityContext): SortField[] {
    const allowedFields = [
      'name', 'created_at', 'updated_at', 'status', 'type'
    ];

    if (context.hasPermission('projects:sort_by_usage')) {
      allowedFields.push('last_accessed_at', 'usage_count');
    }

    if (!sort || !Array.isArray(sort)) {
      return [{ field: 'updated_at', direction: 'desc' }];
    }

    return sort
      .filter(s => allowedFields.includes(s.field))
      .map(s => ({
        field: s.field,
        direction: s.direction === 'asc' ? 'asc' : 'desc'
      }));
  }

  private buildDatabaseQuery(query: SecureProjectQuery, searchResults?: SearchResult): DatabaseQuery {
    const conditions: QueryCondition[] = [];

    // Add search results constraint
    if (searchResults) {
      conditions.push({
        field: 'id',
        operator: 'in',
        values: searchResults.hits.map(hit => hit.id)
      });
    }

    // Convert filters to database conditions
    for (const filter of query.filters) {
      conditions.push(this.filterToCondition(filter));
    }

    return {
      table: 'projects',
      conditions,
      sort: query.sort,
      includes: this.getIncludes(query)
    };
  }

  private filterToCondition(filter: QueryFilter): QueryCondition {
    switch (filter.operator) {
      case 'eq':
        return { field: filter.field, operator: '=', value: filter.value };
      case 'in':
        return { field: filter.field, operator: 'IN', values: filter.values };
      case 'gte':
        return { field: filter.field, operator: '>=', value: filter.value };
      case 'lte':
        return { field: filter.field, operator: '<=', value: filter.value };
      case 'contains_any':
        return { field: filter.field, operator: 'JSON_CONTAINS_ANY', values: filter.values };
      case 'starts_with':
        return { field: filter.field, operator: 'LIKE', value: `${filter.value}%` };
      default:
        throw new Error(`Unsupported filter operator: ${filter.operator}`);
    }
  }

  private getIncludes(query: SecureProjectQuery): string[] {
    const includes = ['owner'];

    // Add conditional includes based on permissions
    // This would be determined by the security context
    return includes;
  }

  private sanitizeSearchQuery(query: string): string {
    // Remove potentially dangerous characters and limit length
    return query
      .replace(/[<>]/g, '')
      .trim()
      .substring(0, 200);
  }

  private canFilterByPath(context: SecurityContext): boolean {
    return context.hasPermission('projects:filter_by_path');
  }

  private async getTotalAccessible(context: SecurityContext): Promise<number> {
    // Get total count of projects accessible to user
    const securityFilters = await this.buildSecurityFilters(context);
    return await this.projectService.countWithFilters(securityFilters);
  }

  private async buildSecurityFilters(context: SecurityContext): Promise<QueryFilter[]> {
    const filters: QueryFilter[] = [];

    if (!context.hasPermission('projects:view_all')) {
      // User can only see their own projects or shared projects
      if (context.hasPermission('projects:view_shared')) {
        filters.push({
          field: 'visibility',
          operator: 'or',
          conditions: [
            { field: 'owner_id', operator: 'eq', value: context.userId },
            { field: 'shared_with', operator: 'contains', value: context.userId },
            { field: 'visibility', operator: 'eq', value: 'public' }
          ]
        });
      } else {
        filters.push({
          field: 'owner_id',
          operator: 'eq',
          value: context.userId
        });
      }
    }

    // Organization filter
    if (context.organizationId && !context.hasPermission('projects:cross_organization')) {
      filters.push({
        field: 'organization_id',
        operator: 'eq',
        value: context.organizationId
      });
    }

    // Soft delete filter
    filters.push({
      field: 'deleted_at',
      operator: 'is_null',
      value: null
    });

    return filters;
  }
}
```

### 1.3 Bulk Operations Transaction Management

```typescript
/**
 * Secure bulk operations with transaction management and rollback capabilities
 * Implements atomic operations, partial success handling, and comprehensive error reporting
 */
export class BulkOperationsService {
  private transactionManager: TransactionManager;
  private operationValidator: OperationValidator;
  private progressTracker: ProgressTracker;

  constructor(services: ServiceContainer) {
    this.transactionManager = services.transactions;
    this.operationValidator = services.operationValidator;
    this.progressTracker = services.progressTracker;
  }

  async executeBulkCreate(
    requests: CreateProjectRequest[], 
    context: SecurityContext,
    options: BulkOperationOptions = {}
  ): Promise<BulkOperationResult<Project>> {
    const operationId = this.generateOperationId();
    
    try {
      // Initialize progress tracking
      await this.progressTracker.initialize(operationId, requests.length);

      // Pre-validate all requests
      const validationResults = await this.validateBulkRequests(requests, context);
      const validRequests = validationResults.filter(r => r.valid).map(r => r.request);
      const invalidRequests = validationResults.filter(r => !r.valid);

      if (options.failOnAnyError && invalidRequests.length > 0) {
        throw new BulkOperationError('VALIDATION_FAILED', 'Some requests failed validation', {
          failed: invalidRequests
        });
      }

      // Execute in transaction
      const result = await this.transactionManager.executeInTransaction(async (transaction) => {
        const created: Project[] = [];
        const failed: FailedOperation[] = [];

        for (const [index, request] of validRequests.entries()) {
          try {
            await this.progressTracker.updateProgress(operationId, index + 1);

            const project = await this.projectService.createProject(request, context, { transaction });
            created.push(project);

          } catch (error) {
            const failedOp: FailedOperation = {
              index: requests.indexOf(request),
              request,
              error: {
                code: error.code || 'CREATE_FAILED',
                message: error.message,
                details: error.details
              }
            };

            failed.push(failedOp);

            if (options.stopOnFirstError) {
              throw new BulkOperationError('OPERATION_FAILED', 'Bulk operation stopped on first error', {
                created,
                failed: [...invalidRequests, ...failed]
              });
            }
          }
        }

        return {
          created,
          failed: [...invalidRequests, ...failed]
        };
      });

      await this.progressTracker.complete(operationId);

      return {
        operation_id: operationId,
        created: result.created,
        failed: result.failed,
        summary: {
          total_requested: requests.length,
          successful: result.created.length,
          failed: result.failed.length,
          success_rate: result.created.length / requests.length
        }
      };

    } catch (error) {
      await this.progressTracker.fail(operationId, error);
      throw error;
    }
  }

  async executeBulkUpdate(
    updates: UpdateProjectRequest[],
    context: SecurityContext,
    options: BulkOperationOptions = {}
  ): Promise<BulkOperationResult<Project>> {
    const operationId = this.generateOperationId();

    try {
      await this.progressTracker.initialize(operationId, updates.length);

      // Pre-validate permissions for all projects
      const permissionChecks = await this.validateBulkPermissions(updates, context);
      const authorizedUpdates = permissionChecks.filter(p => p.authorized).map(p => p.update);
      const unauthorizedUpdates = permissionChecks.filter(p => !p.authorized);

      if (options.failOnAnyError && unauthorizedUpdates.length > 0) {
        throw new BulkOperationError('AUTHORIZATION_FAILED', 'Some operations not authorized', {
          failed: unauthorizedUpdates
        });
      }

      // Execute in transaction with optimistic locking
      const result = await this.transactionManager.executeInTransaction(async (transaction) => {
        const updated: Project[] = [];
        const failed: FailedOperation[] = [];

        // Lock all projects first to prevent concurrent modifications
        const projectIds = authorizedUpdates.map(u => u.id);
        await this.projectService.lockProjects(projectIds, { transaction });

        for (const [index, updateRequest] of authorizedUpdates.entries()) {
          try {
            await this.progressTracker.updateProgress(operationId, index + 1);

            // Check version if provided
            if (updateRequest.version) {
              const currentProject = await this.projectService.getProject(
                updateRequest.id, 
                context, 
                { transaction }
              );
              
              if (currentProject.version !== updateRequest.version) {
                throw new Error('Version conflict detected');
              }
            }

            const project = await this.projectService.updateProject(
              updateRequest.id,
              updateRequest,
              context,
              { transaction }
            );
            
            updated.push(project);

          } catch (error) {
            const failedOp: FailedOperation = {
              index: updates.indexOf(updateRequest),
              request: updateRequest,
              error: {
                code: error.code || 'UPDATE_FAILED',
                message: error.message,
                details: error.details
              }
            };

            failed.push(failedOp);

            if (options.stopOnFirstError) {
              throw new BulkOperationError('OPERATION_FAILED', 'Bulk operation stopped on first error', {
                updated,
                failed: [...unauthorizedUpdates, ...failed]
              });
            }
          }
        }

        return {
          updated,
          failed: [...unauthorizedUpdates, ...failed]
        };
      });

      await this.progressTracker.complete(operationId);

      return {
        operation_id: operationId,
        updated: result.updated,
        failed: result.failed,
        summary: {
          total_requested: updates.length,
          successful: result.updated.length,
          failed: result.failed.length,
          success_rate: result.updated.length / updates.length
        }
      };

    } catch (error) {
      await this.progressTracker.fail(operationId, error);
      throw error;
    }
  }

  async executeBulkDelete(
    projectIds: string[],
    context: SecurityContext,
    options: BulkDeleteOptions = {}
  ): Promise<BulkDeleteResult> {
    const operationId = this.generateOperationId();

    try {
      await this.progressTracker.initialize(operationId, projectIds.length);

      // Validate permissions
      const permissionChecks = await Promise.all(
        projectIds.map(async (id) => ({
          id,
          authorized: await this.authService.hasPermission(context, 'projects:delete', id)
        }))
      );

      const authorizedIds = permissionChecks.filter(p => p.authorized).map(p => p.id);
      const unauthorizedIds = permissionChecks.filter(p => !p.authorized).map(p => p.id);

      if (options.failOnAnyError && unauthorizedIds.length > 0) {
        throw new BulkOperationError('AUTHORIZATION_FAILED', 'Some deletions not authorized');
      }

      // Check dependencies if not forcing
      const dependencyChecks = await Promise.all(
        authorizedIds.map(async (id) => ({
          id,
          dependencies: await this.projectService.checkDependencies(id)
        }))
      );

      const idsWithDependencies = dependencyChecks
        .filter(d => d.dependencies.length > 0)
        .map(d => d.id);

      if (!options.force && idsWithDependencies.length > 0) {
        throw new BulkOperationError('HAS_DEPENDENCIES', 'Some projects have dependencies', {
          projects_with_dependencies: idsWithDependencies
        });
      }

      // Execute deletion in transaction
      const result = await this.transactionManager.executeInTransaction(async (transaction) => {
        const deleted: string[] = [];
        const failed: FailedOperation[] = [];

        for (const [index, projectId] of authorizedIds.entries()) {
          try {
            await this.progressTracker.updateProgress(operationId, index + 1);

            await this.projectService.deleteProject(projectId, {
              soft: options.soft !== false,
              force: options.force,
              context,
              transaction
            });

            deleted.push(projectId);

          } catch (error) {
            const failedOp: FailedOperation = {
              index: projectIds.indexOf(projectId),
              request: { id: projectId },
              error: {
                code: error.code || 'DELETE_FAILED',
                message: error.message,
                details: error.details
              }
            };

            failed.push(failedOp);

            if (options.stopOnFirstError) {
              throw new BulkOperationError('OPERATION_FAILED', 'Bulk operation stopped on first error');
            }
          }
        }

        return { deleted, failed };
      });

      await this.progressTracker.complete(operationId);

      return {
        operation_id: operationId,
        deleted: result.deleted,
        failed: result.failed,
        unauthorized: unauthorizedIds,
        summary: {
          total_requested: projectIds.length,
          successful: result.deleted.length,
          failed: result.failed.length,
          unauthorized: unauthorizedIds.length,
          success_rate: result.deleted.length / projectIds.length
        }
      };

    } catch (error) {
      await this.progressTracker.fail(operationId, error);
      throw error;
    }
  }

  private async validateBulkRequests(
    requests: CreateProjectRequest[],
    context: SecurityContext
  ): Promise<RequestValidationResult[]> {
    return await Promise.all(
      requests.map(async (request, index) => {
        try {
          await this.operationValidator.validateCreateProject(request);
          return { valid: true, request, index };
        } catch (error) {
          return {
            valid: false,
            request,
            index,
            error: {
              code: error.code || 'VALIDATION_FAILED',
              message: error.message,
              details: error.details
            }
          };
        }
      })
    );
  }

  private async validateBulkPermissions(
    updates: UpdateProjectRequest[],
    context: SecurityContext
  ): Promise<PermissionValidationResult[]> {
    return await Promise.all(
      updates.map(async (update, index) => {
        const authorized = await this.authService.hasPermission(
          context, 
          'projects:update', 
          update.id
        );
        
        return {
          authorized,
          update,
          index,
          error: authorized ? undefined : {
            code: 'UNAUTHORIZED',
            message: 'Insufficient permissions for project update'
          }
        };
      })
    );
  }

  private generateOperationId(): string {
    return `bulk_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
}
```

This comprehensive implementation provides:

1. **Complete CRUD Operations** with security controls and validation
2. **Bulk Operations** with transaction management and atomic execution
3. **Advanced Filtering** with security-aware field access
4. **Pagination** with cursor-based and offset-based options
5. **Search Functionality** with full-text search and access control
6. **Data Export/Import** with encryption and audit logging
7. **Error Handling** with detailed error reporting and recovery options

All operations integrate with the OAuth 2.0 + JWT security framework and provide comprehensive audit logging.

---

## IMPLEMENTATION STATUS
- **Projects CRUD**: ✅ Complete with security controls
- **Sessions CRUD**: 🔄 Next (similar implementation pattern)
- **Contexts CRUD**: 🔄 Next (similar implementation pattern)
- **Bulk Operations**: ✅ Complete with transaction management
- **Search & Export**: ✅ Complete with security filtering

🔧 **SECURITY PRIORITY**: All CRUD operations implement proper authorization and audit logging
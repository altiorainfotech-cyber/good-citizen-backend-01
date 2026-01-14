#!/bin/bash

# Production deployment script for Ride-Hailing Backend
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="./backups"
LOG_FILE="./deploy.log"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a $LOG_FILE
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a $LOG_FILE
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    if [ ! -f ".env.production" ]; then
        error "Production environment file (.env.production) not found"
    fi
    
    log "Prerequisites check passed"
}

# Backup database
backup_database() {
    log "Creating database backup..."
    
    mkdir -p $BACKUP_DIR
    
    # MongoDB backup
    BACKUP_FILE="$BACKUP_DIR/mongodb_backup_$(date +%Y%m%d_%H%M%S).gz"
    
    if docker-compose -f $DOCKER_COMPOSE_FILE ps mongodb | grep -q "Up"; then
        docker-compose -f $DOCKER_COMPOSE_FILE exec -T mongodb mongodump --archive --gzip > $BACKUP_FILE
        log "Database backup created: $BACKUP_FILE"
    else
        warn "MongoDB container not running, skipping backup"
    fi
}

# Health check
health_check() {
    log "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/health &> /dev/null; then
            log "Health check passed"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    error "Health check failed after $max_attempts attempts"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    docker-compose -f $DOCKER_COMPOSE_FILE exec -T app npm run migration:run
    
    if [ $? -eq 0 ]; then
        log "Database migrations completed successfully"
    else
        error "Database migrations failed"
    fi
}

# Deploy application
deploy() {
    log "Starting deployment..."
    
    # Pull latest images
    log "Pulling latest Docker images..."
    docker-compose -f $DOCKER_COMPOSE_FILE pull
    
    # Build application image
    log "Building application image..."
    docker-compose -f $DOCKER_COMPOSE_FILE build app
    
    # Start services
    log "Starting services..."
    docker-compose -f $DOCKER_COMPOSE_FILE up -d
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Run migrations
    run_migrations
    
    # Health check
    health_check
    
    log "Deployment completed successfully"
}

# Rollback function
rollback() {
    log "Rolling back deployment..."
    
    # Stop current services
    docker-compose -f $DOCKER_COMPOSE_FILE down
    
    # Restore from backup if available
    LATEST_BACKUP=$(ls -t $BACKUP_DIR/mongodb_backup_*.gz 2>/dev/null | head -n1)
    if [ -n "$LATEST_BACKUP" ]; then
        log "Restoring database from backup: $LATEST_BACKUP"
        docker-compose -f $DOCKER_COMPOSE_FILE up -d mongodb
        sleep 10
        docker-compose -f $DOCKER_COMPOSE_FILE exec -T mongodb mongorestore --archive --gzip < $LATEST_BACKUP
    fi
    
    # Start previous version (this would need version management)
    docker-compose -f $DOCKER_COMPOSE_FILE up -d
    
    log "Rollback completed"
}

# Cleanup old images and containers
cleanup() {
    log "Cleaning up old Docker images and containers..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused containers
    docker container prune -f
    
    # Remove unused volumes (be careful with this in production)
    # docker volume prune -f
    
    log "Cleanup completed"
}

# Main deployment process
main() {
    log "Starting production deployment process..."
    
    # Check if rollback is requested
    if [ "$1" = "rollback" ]; then
        rollback
        exit 0
    fi
    
    # Check if cleanup is requested
    if [ "$1" = "cleanup" ]; then
        cleanup
        exit 0
    fi
    
    # Normal deployment process
    check_prerequisites
    backup_database
    deploy
    cleanup
    
    log "Production deployment completed successfully!"
    log "Application is running at: https://your-domain.com"
    log "Monitoring dashboard: http://your-domain.com:3001"
    log "Metrics endpoint: http://your-domain.com:9090"
}

# Trap errors and provide rollback option
trap 'error "Deployment failed! Run ./deploy.sh rollback to rollback changes."' ERR

# Run main function
main "$@"
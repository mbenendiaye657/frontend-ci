// Pipeline CI du frontend : build, tests, scan du code, image Docker, scan Trivy, push Docker Hub.
// Prérequis Jenkins : Docker CLI accessible à l'agent, identifiants Docker Hub
// enregistrés sous l'ID « dockerhub-creds » (Nom d'utilisateur + mot de passe/token).
pipeline {
  agent any

  environment {
    DOCKERHUB_USER = 'VOTRE_USER_DOCKERHUB'          // à remplacer
    IMAGE          = "${DOCKERHUB_USER}/esante-frontend"
    TAG            = "${env.BUILD_NUMBER}"
    TEST_IMAGE     = 'esante-frontend-test'
  }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  triggers {
    githubPush()   // déclenché par le webhook GitHub à chaque push
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Installation et tests unitaires') {
      steps {
        // npm ci + vitest s'exécutent dans l'étape « test » du Dockerfile
        sh 'docker build --target test -t $TEST_IMAGE .'
      }
    }

    stage('Scan de sécurité du code (npm audit)') {
      steps {
        // Le build passe en « instable » (et non en échec) si une vulnérabilité HIGH est trouvée
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          sh '''
            docker run --rm $TEST_IMAGE npm audit --omit=dev --audit-level=high > npm-audit.txt 2>&1
            CODE=$?
            cat npm-audit.txt
            exit $CODE
          '''
        }
      }
    }

    // Optionnel : analyse SonarQube (nécessite un serveur SonarQube et son plugin Jenkins)
    // stage('SonarQube') {
    //   steps {
    //     withSonarQubeEnv('sonarqube') {
    //       sh 'docker run --rm -e SONAR_HOST_URL=$SONAR_HOST_URL -e SONAR_TOKEN=$SONAR_AUTH_TOKEN -v "$PWD:/usr/src" sonarsource/sonar-scanner-cli -Dsonar.projectKey=esante-frontend -Dsonar.sources=src'
    //     }
    //   }
    // }

    stage('Build de l\'image Docker') {
      steps {
        sh 'docker build -t $IMAGE:$TAG -t $IMAGE:latest .'
      }
    }

    stage('Scan de l\'image (Trivy)') {
      steps {
        // 1) Rapport complet HIGH et CRITICAL (archivé, ne bloque pas)
        sh '''
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v trivy-cache:/root/.cache/ \
            aquasec/trivy:latest image --severity HIGH,CRITICAL --exit-code 0 $IMAGE:$TAG | tee trivy-report.txt
        '''
        // 2) Portail qualité : échec s'il reste une vulnérabilité CRITICAL corrigeable
        sh '''
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v trivy-cache:/root/.cache/ \
            aquasec/trivy:latest image --severity CRITICAL --ignore-unfixed --exit-code 1 --quiet $IMAGE:$TAG
        '''
      }
    }

    stage('Push vers Docker Hub') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''
            echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
            docker push $IMAGE:$TAG
            docker push $IMAGE:latest
          '''
        }
      }
    }

    // Optionnel : déclenche directement le job de déploiement (sinon webhook sur deployment-cd)
    // stage('Déclencher le CD') {
    //   steps {
    //     build job: 'deployment-cd', wait: false, propagate: false
    //   }
    // }
  }

  post {
    always {
      archiveArtifacts artifacts: 'npm-audit.txt, trivy-report.txt', allowEmptyArchive: true
      sh 'docker logout || true'
      sh 'docker image prune -f || true'
    }
    success {
      echo "Image publiée : ${IMAGE}:${TAG}"
    }
    failure {
      echo 'Pipeline en échec : consultez les logs de l\'étape concernée.'
    }
  }
}

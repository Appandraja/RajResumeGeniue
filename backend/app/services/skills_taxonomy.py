"""Curated skills taxonomy used for deterministic keyword extraction.

Each line is ``Canonical Name|alias|alias``. Matching is case-insensitive, ignores simple
plurals and treats hyphens/slashes as word separators, so aliases only need to list real
synonyms or abbreviations ("k8s" -> Kubernetes), not spelling variants.
"""

from collections.abc import Iterator

_RAW: dict[str, str] = {
    "programming": """
Python|python3
JavaScript|js|ecmascript|es6|es2015
TypeScript|=TS
Java|java ee|j2ee|jvm
C++|cpp
C#|csharp|c sharp
=Go|golang|go language|go programming
=Rust|rust lang
Ruby
PHP
=Swift
Kotlin
Scala
Perl
R Programming|r language|rstudio
MATLAB
=Dart
Elixir
Haskell
Clojure
Objective-C|objc
Bash|shell scripting|shell script|bash scripting
PowerShell
SQL|structured query language
PL/SQL|plsql
T-SQL|tsql
NoSQL
GraphQL
HTML|html5
CSS|css3
Sass|scss
Lua
=Groovy
COBOL
Assembly|assembly language
VBA|visual basic
Solidity
WebAssembly|wasm
""",
    "frameworks": """
React|react.js|reactjs
React Native
Redux
Next.js|nextjs
Angular|angularjs|angular.js
Vue.js|vue|vuejs
Svelte|sveltekit
jQuery
Node.js|nodejs|=Node
Express.js|=Express|expressjs
NestJS|nest.js
Django
Flask
FastAPI
Spring Boot|springboot
Spring Framework
Hibernate
.NET|dotnet|dot net
ASP.NET|aspnet
.NET Core|dotnet core
Entity Framework
Ruby on Rails|=Rails|ror
Laravel
Symfony
TensorFlow
PyTorch
Keras
scikit-learn|sklearn|scikit learn
Pandas
NumPy
SciPy
Matplotlib
Apache Spark|=Spark|pyspark
Hadoop
Apache Kafka|kafka
Apache Airflow|airflow
dbt|data build tool
Flutter
Ionic
=Electron
Tailwind CSS|tailwind
Bootstrap
Material UI|=MUI
Chakra UI
Storybook
Webpack
=Vite
Jest
Cypress
Selenium
Playwright
JUnit
pytest
=Mocha
RxJS
gRPC
REST API|restful|rest apis|restful api|=REST
SOAP
WebSockets|websocket
OpenAPI|swagger
=Unity
Unreal Engine|unreal
LangChain
Hugging Face|huggingface
OpenCV
""",
    "databases": """
PostgreSQL|postgres|psql
MySQL
MariaDB
SQL Server|mssql|microsoft sql server
Oracle Database|oracle db|oracle
SQLite
MongoDB|mongo
Redis
Elasticsearch|elastic search|=ELK
Cassandra
DynamoDB
Snowflake
BigQuery
Redshift
Databricks
Neo4j
CouchDB
Firebase
Supabase
Data Warehouse|data warehousing|dwh
ETL|extract transform load|elt
Data Modeling|data modelling
Database Design
Query Optimization|query tuning
""",
    "cloud_devops": """
AWS|amazon web services
Azure|microsoft azure
Google Cloud|gcp|google cloud platform
Docker|containerization|containers
Kubernetes|k8s
=Helm
Terraform
Ansible
=Puppet
=Chef
Pulumi
CloudFormation
Jenkins
GitHub Actions
GitLab CI
CircleCI
Travis CI
ArgoCD|argo cd
CI/CD|cicd|continuous integration|continuous delivery|continuous deployment
DevOps
DevSecOps
=SRE|site reliability|site reliability engineering
Infrastructure as Code|iac
Linux|unix
Nginx
Apache HTTP Server|apache httpd
Prometheus
Grafana
Datadog
New Relic
Splunk
=Sentry
OpenTelemetry
Monitoring|observability
Serverless
AWS Lambda|=Lambda
EC2
S3
Microservices|microservice architecture
Load Balancing|load balancer
Cloud Computing|cloud infrastructure|cloud platform
Networking|tcp/ip|tcp ip
Git|version control
GitHub
GitLab
Bitbucket
Jira
Confluence
Vagrant
Istio|service mesh
RabbitMQ
Message Queue|message queues|message broker
Event-Driven Architecture|event driven
Disaster Recovery
High Availability
Cloud Migration
""",
    "engineering_practices": """
Agile|agile methodology|agile methodologies
Scrum
Kanban
Test-Driven Development|tdd
Behavior-Driven Development|bdd
Unit Testing|unit tests
Integration Testing|integration tests
End-to-End Testing|e2e testing|e2e
Test Automation|automated testing|automation testing
=QA|quality assurance
Code Review|code reviews|peer review
System Design|systems design
Software Architecture|solution architecture
API Design
Design Patterns
Object-Oriented Programming|oop|object oriented
Functional Programming
Data Structures|algorithms|data structures and algorithms|dsa
Performance Optimization|performance tuning
Refactoring
Technical Documentation
Debugging|troubleshooting
Software Development Life Cycle|sdlc
Pair Programming
Technical Debt
Scalability|scalable systems|distributed systems
Concurrency|multithreading|multi-threading
Responsive Design|responsive web design
Accessibility|wcag|a11y
Progressive Web Apps|pwa
Mobile Development|mobile app development
iOS|ios development
Android|android development
Full Stack|full-stack|fullstack
Frontend|front end|front-end development
Backend|back end|back-end development
Web Development
Embedded Systems|embedded
IoT|internet of things
Blockchain
Cybersecurity|information security|infosec|cyber security
Penetration Testing|pentest|pen testing
OAuth|oauth2|oauth 2.0
JWT|json web token
SSO|single sign-on
Encryption|cryptography
Identity and Access Management|iam
SOC 2|soc2
GDPR
HIPAA
PCI DSS|pci-dss
ISO 27001
Vulnerability Management|vulnerability assessment
SIEM
Incident Response
""",
    "data_ai": """
Machine Learning|=ML
Deep Learning|neural networks|neural network
Artificial Intelligence|=AI
Natural Language Processing|nlp
Computer Vision
Generative AI|genai|gen ai
Large Language Models|llm|llms
Prompt Engineering
Reinforcement Learning
MLOps
Feature Engineering
Predictive Modeling|predictive modelling|predictive analytics
Statistical Analysis|statistics|statistical modeling
A/B Testing|ab testing|split testing|experimentation
Hypothesis Testing
Regression Analysis|regression
Time Series|time series analysis|forecasting
Data Analysis|data analytics|analytics
Data Science
Data Engineering
Data Visualization|data viz|dataviz
Data Mining
Data Cleaning|data wrangling|data preparation
Data Pipeline|data pipelines
Data Governance
Data Quality
Big Data
Business Intelligence|bi tools|bi reporting
Tableau
Power BI|powerbi
Looker
Qlik|qlikview|qlik sense
=Excel|microsoft excel|ms excel|spreadsheets
Google Sheets
Google Analytics|ga4
Mixpanel
Amplitude
=SAS
SPSS
Stata
Jupyter|jupyter notebook
Reporting|dashboards|dashboard
KPI|kpis|key performance indicators
OLAP
Recommendation Systems|recommender systems
Model Deployment
Vector Database|vector databases
RAG|retrieval augmented generation|retrieval-augmented generation
""",
    "design": """
UI/UX Design|ui ux
UX Design|user experience|=UX
UI Design|user interface|=UI
User Research|ux research
Wireframing|wireframes|wireframe
Prototyping|prototypes|prototype
Figma
=Sketch
Adobe XD
Adobe Photoshop|photoshop
Adobe Illustrator|illustrator
Adobe InDesign|indesign
Adobe Premiere|premiere pro
After Effects
Canva
Design Systems|design system
Interaction Design
Visual Design
Graphic Design
Typography
Branding|brand identity|brand design
Information Architecture
Usability Testing|user testing
Motion Graphics
Video Editing
Photography
3D Modeling|3d modelling
AutoCAD
SolidWorks
Product Design
Illustration
Design Thinking
Persona Development|personas
User Journey|customer journey|journey mapping
""",
    "marketing": """
Digital Marketing
Content Marketing
Content Strategy
Content Creation|content writing
Copywriting|copy writing
SEO|search engine optimization
=SEM|search engine marketing
PPC|pay per click|paid search
Paid Social|paid media|paid advertising
Google Ads|adwords
Facebook Ads|meta ads
LinkedIn Ads
Social Media Marketing|social media|social media management
Email Marketing|email campaigns|email campaign
Marketing Automation
HubSpot
Marketo
Mailchimp
Salesforce Marketing Cloud
Brand Management|brand strategy
Brand Awareness
Product Marketing
Growth Marketing|growth hacking
Demand Generation|demand gen
Lead Generation|lead gen
Conversion Rate Optimization|=CRO
Campaign Management|marketing campaigns|campaign
Market Research
Competitive Analysis|competitor analysis|competitive research
Marketing Strategy
Go-to-Market|gtm|go to market
Customer Acquisition
Customer Retention|retention
Customer Segmentation|segmentation
Influencer Marketing
Public Relations|=PR
Event Marketing|event planning
Account-Based Marketing|abm
Affiliate Marketing
Marketing Analytics
Content Management Systems|cms|wordpress
Video Marketing
Podcast
Storytelling
Newsletter|newsletters
Marketing Operations
Community Management|community building
Customer Engagement
Messaging|brand messaging
Keyword Research
Web Analytics
Shopify
E-commerce|ecommerce
""",
    "sales": """
B2B Sales|b2b
B2C Sales|b2c
Sales Strategy
Business Development|biz dev|bizdev
Account Management|key account management
Account Executive
Lead Qualification
Prospecting|outbound sales|cold calling|cold outreach
Inside Sales
Enterprise Sales
SaaS Sales
Consultative Selling|solution selling
Negotiation|negotiating|contract negotiation
Closing Deals|deal closing
Sales Pipeline|pipeline management
Sales Forecasting
Quota Attainment|quota|exceeded quota
Salesforce|sfdc
CRM|customer relationship management
Customer Success
Customer Service|customer support|client services
Client Relationship Management|client relations|relationship building
Upselling|cross-selling|upsell
Territory Management
Channel Sales|partnerships|partner management
Sales Enablement
RFP|rfps|proposal writing
Sales Operations
Zendesk
=Outreach
ZoomInfo
Pricing Strategy|pricing
Customer Onboarding|onboarding
Renewals
Churn Reduction|churn
""",
    "finance": """
Financial Analysis|financial analyst
Financial Modeling|financial modelling
Financial Reporting
Financial Planning|fp&a|fpa
Budgeting|budget management|budget
Forecasting and Budgeting
Accounting
Accounts Payable|=AP
Accounts Receivable|=AR
General Ledger|=GL
Bookkeeping
Payroll
Month-End Close|month end close|period close|financial close
Reconciliation|reconciliations|account reconciliation
Auditing|audit|internal audit
Internal Controls|sox|sarbanes-oxley
GAAP|us gaap
IFRS
Tax|taxation|tax preparation|tax compliance
Treasury|cash management
Cash Flow|cash flow management
Variance Analysis
Cost Accounting|cost analysis|cost reduction
Risk Management|risk assessment
Credit Analysis|credit risk
Investment Analysis|investment banking|portfolio management
Valuation|dcf
Mergers and Acquisitions|m&a
Due Diligence
Compliance|regulatory compliance
Anti-Money Laundering|aml
KYC|know your customer
QuickBooks
SAP
Oracle Financials|oracle erp
NetSuite
Xero
ERP|enterprise resource planning
Bloomberg
Procurement|purchasing|sourcing
Vendor Management|supplier management
Contract Management
Revenue Recognition
Financial Controls
Pivot Tables|vlookup|xlookup
""",
    "hr": """
Recruiting|recruitment|talent acquisition
Sourcing Candidates|candidate sourcing
Interviewing|interview process
Onboarding Programs|new hire onboarding
Employee Relations
Employee Engagement
Performance Management|performance reviews
Compensation and Benefits|compensation|benefits administration
HR Business Partner|hrbp
Talent Management|talent development
Succession Planning
Learning and Development|training and development|l&d
Training|trainings|employee training
Workforce Planning|headcount planning
Diversity and Inclusion|=DEI|diversity equity and inclusion
HRIS|workday|bamboohr
Applicant Tracking System|=ATS|=Greenhouse|=Lever
Labor Law|employment law|labour law
Organizational Development|org development
Change Management|change leadership
Conflict Resolution|mediation
Coaching|mentoring|mentorship|mentor
Culture Building|company culture|culture
Offboarding
Job Descriptions|job description
Employer Branding
""",
    "healthcare": """
Patient Care
Patient Safety
Clinical Research|clinical trials
Clinical Documentation
Electronic Health Records|ehr|emr|=Epic
Medical Terminology
Medical Coding|icd-10|icd 10|cpt coding
Medical Billing|billing and coding
Nursing|registered nurse
Triage
Vital Signs
Medication Administration
Phlebotomy
Infection Control
Healthcare Compliance
Case Management
Care Coordination
Pharmacy|pharmaceutical
Public Health
Telehealth|telemedicine
Mental Health
Physical Therapy
Radiology
Laboratory|lab techniques
Quality Improvement
Regulatory Affairs
Medical Devices
Health Informatics
Utilization Review
Patient Education
Wound Care
""",
    "operations": """
Project Management
Program Management
Product Management
Product Roadmap|roadmapping|roadmap
Product Strategy
Product Development
Product Lifecycle
User Stories|user story|requirements gathering
Requirements Analysis|business requirements
Business Analysis|business analyst
Process Improvement|process optimization|continuous improvement
Process Mapping|process documentation
=Lean|lean manufacturing
Six Sigma|lean six sigma
Kaizen
Operations Management
Supply Chain|supply chain management|scm
Logistics
Inventory Management|inventory control
Warehouse Management|warehouse operations
Demand Planning
Quality Control|=QC
Quality Management
Stakeholder Management|stakeholder engagement|stakeholder communication
Vendor Relations
Resource Allocation|resource planning|resource management
Risk Mitigation
Scope Management
Cross-Functional Collaboration|cross functional|cross-functional teams
Strategic Planning|strategy
Business Strategy
OKRs|okr|goal setting
Roadmap Planning
Capacity Planning
Workflow Automation|process automation
RPA|robotic process automation
Microsoft Project|ms project
Asana
Trello
Monday.com
Smartsheet
=Notion
=Slack
Microsoft Teams
Microsoft Office|ms office|office 365|microsoft 365
=Word|microsoft word
PowerPoint|microsoft powerpoint|ms powerpoint
=Outlook
SharePoint
Visio
ServiceNow
ITIL
IT Support|help desk|helpdesk|technical support
Customer Experience|=CX
Facilities Management
Event Management
Administrative Support|administrative duties|office administration
Calendar Management|scheduling
Data Entry
Records Management
Health and Safety|ehs|osha
Manufacturing
Construction Management
Estimating
Fleet Management
Maintenance|preventive maintenance
Merchandising
Retail Operations|store operations
Hospitality
Food Safety|haccp
Budget Planning
Business Process Management|=BPM
Product Analytics
Prioritization|prioritisation
Customer Discovery
Minimum Viable Product|mvp
Business Case
Benchmarking
""",
    "soft_skills": """
Leadership|team leadership|leading teams
People Management|team management|managing teams
Communication|communication skills|verbal communication|written communication
Public Speaking|presentations|presentation skills|presenting
Collaboration|teamwork|team player
Problem Solving|problem-solving|analytical thinking|analytical skills
Critical Thinking
Decision Making|decision-making
Time Management
Adaptability|flexibility
Creativity|creative thinking
Attention to Detail|detail-oriented|detail oriented
Customer Focus|customer-centric|customer centric
Project Planning
Self-Motivated|self-starter|self motivated
Interpersonal Skills
Emotional Intelligence
Influencing|influence
Strategic Thinking
Multitasking
Organizational Skills|organisational skills
Proactive
Mentoring Junior|team building
Cross-Cultural Communication|intercultural
Remote Work|remote collaboration|distributed teams
Technical Writing
Research|research skills
Training Delivery|facilitation|workshop facilitation
Active Listening
Work Ethic|accountability
Ownership|end-to-end ownership
""",
    "certifications": """
PMP|project management professional
PRINCE2
CAPM
Certified ScrumMaster|=CSM|scrum master
Certified Product Owner|cspo|product owner
SAFe|scaled agile
CISSP
CISM
CEH|certified ethical hacker
CompTIA Security+|security+
CompTIA A+|a+
CompTIA Network+|network+
CCNA
CCNP
AWS Certified Solutions Architect|aws solutions architect
AWS Certified Developer
AWS Certified|aws certification
Azure Certified|azure certification|az-900|az-104
Google Cloud Certified|gcp certification
Certified Kubernetes Administrator|cka
CKAD
Terraform Associate
Salesforce Certified|salesforce certification
CPA|certified public accountant
CFA|chartered financial analyst
=CMA
ACCA
=CIA|certified internal auditor
PHR
SHRM-CP|shrm-scp|shrm
CPHR
=RN
BLS|basic life support
ACLS
CPR
=CNA
Six Sigma Green Belt|green belt
Six Sigma Black Belt|black belt
ITIL Foundation|itil certification
Google Analytics Certification
HubSpot Certification
Tableau Certification
Microsoft Certified
Oracle Certified
CDL|commercial driver's license
Scrum Alliance
""",
}

# Categories whose entries are credentials: they are never offered as "add to skills" actions.
CERTIFICATION_CATEGORIES: frozenset[str] = frozenset({"certifications"})


def iter_terms() -> Iterator[tuple[str, str, tuple[str, ...]]]:
    """Yield (category, canonical name, aliases) for every taxonomy entry."""
    for category, block in _RAW.items():
        for line in block.strip().splitlines():
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if parts:
                yield category, parts[0], tuple(parts[1:])

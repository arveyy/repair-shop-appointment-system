# Device Repair Appointment System

## Overview
The Device Repair Appointment System is a web-based application designed to improve how device repair shops manage customer repair requests.  
It replaces unstructured Facebook Messenger inquiries with a centralized, efficient, and organized appointment and repair queue system.

The system supports multiple branches and processes repair requests using the FIFO (First-In, First-Out) scheduling algorithm to ensure fairness and efficiency.

---

## Problem Statement
Many small device repair shops rely on Facebook Messenger for handling repair inquiries. This manual process results in:
- Delayed responses
- Repeated back-and-forth questions
- Unstructured customer information
- Difficulty tracking repair order and status

These issues slow down service and reduce customer satisfaction.

---

## Proposed Solution
This system provides a structured web-based platform where:
- Customers can submit repair requests through an online form
- Repair requests are automatically queued using FIFO
- Each branch manages its own repair queue
- Staff can easily track and update repair statuses

---

## Key Features
- Online repair appointment booking
- FIFO-based repair queue management
- Multi-branch support
- Admin dashboard for repair shop staff
- Repair status tracking (Waiting, In Progress, Completed)
- Structured and centralized customer data

---

## Algorithm Used
- **FIFO (First-In, First-Out)**  
  Repair jobs are processed in the order they are received within each branch to ensure fairness and simplicity.

---

## System Users
- **Customers** – Submit repair appointments and check repair status
- **Admin / Repair Shop Staff** – Manage repair queue and update repair progress

---

## Technology Stack
- **Frontend:** Web-based interface (HTML, CSS, JavaScript – planned)
- **Backend:** To be implemented
- **Database:** Microsoft SQL Server

---

## System Scope
- Appointment-based repair requests
- Single technician per branch (assumed always available)
- Separate repair queues per branch
- Walk-in handling is considered out of scope for the current version

---

## Future Enhancements
- Walk-in customer prioritization
- SMS or email notifications
- Online payment integration
- Repair history per customer
- Technician management

---

## Project Status
🚧 In development

---

## Author
**Arvy Sabalande**

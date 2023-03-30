const sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      should = require('should')

describe('i18n import/export', function() {

  afterEach(sandboxed(function() {
    global.org.objects.i18n.deleteMany().skipAcl().grant(8).execute()
  }))

  it('i18n object should be imported properly', async function() {

    await promised(null, sandboxed(function() {
      // create templates
      /* global org */
      const { environment } = require('developer'),
            data = [
              { 'object': 'manifest', 'i18ns': { 'includes': ['*'] } },
              {
                'assets': [],
                'data': {
                  'object': {
                    'account': {
                      'label': 'Account',
                      'properties': {
                        'c_enrollments': {
                          'label': 'Enrollments',
                          'properties': {
                            'c_group': {
                              'label': 'Group'
                            },
                            'c_joined': {
                              'label': 'Joined'
                            },
                            'c_left': {
                              'label': 'Left'
                            },
                            'c_study': {
                              'label': 'Study'
                            }
                          }
                        },
                        'c_health_data': {
                          'label': 'Health Data'
                        },
                        'c_public_identifier': {
                          'label': 'Public Identifier'
                        },
                        'c_public_users': {
                          'label': 'Participants'
                        },
                        'c_site_app_settings': {
                          'label': 'Site App Settings',
                          'properties': {
                            'c_pin': {
                              'label': 'c_pin'
                            }
                          }
                        },
                        'c_study_groups': {
                          'label': 'Study Groups'
                        },
                        'c_sites': {
                          'label': 'Sites'
                        }
                      }
                    },
                    'c_branch': {
                      'label': 'Branch',
                      'properties': {
                        'c_conditions': {
                          'label': 'Conditions',
                          'properties': {
                            'c_destination': {
                              'label': 'Destination'
                            },
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_operators': {
                              'label': 'Operators'
                            },
                            'c_order': {
                              'label': 'Order'
                            },
                            'c_selector': {
                              'label': 'Selector'
                            },
                            'c_values': {
                              'label': 'Values'
                            }
                          }
                        },
                        'c_default_destination': {
                          'label': 'Default Destination'
                        },
                        'c_key': {
                          'label': 'Key'
                        },
                        'c_name': {
                          'label': 'Name'
                        },
                        'c_task': {
                          'label': 'Task'
                        },
                        'c_trigger': {
                          'label': 'Trigger'
                        }
                      }
                    },
                    'c_call': {
                      'label': 'Call',
                      'properties': {
                        'c_public_user': {
                          'label': 'Participant'
                        },
                        'c_room': {
                          'label': 'Room'
                        },
                        'c_site': {
                          'label': 'Site'
                        },
                        'c_status': {
                          'label': 'Status'
                        }
                      }
                    },
                    'c_event': {
                      'label': 'Event',
                      'objectTypes': {
                        'c_televisit_event': {
                          'properties': {
                            'c_canceled': {
                              'label': 'Canceled'
                            },
                            'c_group': {
                              'label': 'Group'
                            },
                            'c_reminders': {
                              'label': 'Reminder Type'
                            }
                          }
                        }
                      },
                      'properties': {
                        'c_end': {
                          'label': 'End'
                        },
                        'c_public_user': {
                          'label': 'Participant'
                        },
                        'c_start': {
                          'label': 'Start'
                        },
                        'c_timezone': {
                          'label': 'Timezone'
                        },
                        'c_title': {
                          'label': 'Title'
                        }
                      }
                    },
                    'c_fault': {
                      'label': 'Fault',
                      'properties': {
                        'c_detail_code': {
                          'label': 'Detail Code'
                        },
                        'c_error_code': {
                          'label': 'Error Code'
                        },
                        'c_key': {
                          'label': 'Key'
                        },
                        'c_message': {
                          'label': 'Message'
                        },
                        'c_namespace': {
                          'label': 'Namespace'
                        },
                        'c_native_code': {
                          'label': 'Native Code'
                        },
                        'c_reason': {
                          'label': 'Reason'
                        }
                      }
                    },
                    'c_group': {
                      'label': 'Participant Group',
                      'properties': {
                        'c_description': {
                          'description': 'A human friendly description of the group, for display in study builder.',
                          'label': 'Description'
                        },
                        'c_display_in_invite_list': {
                          'label': 'Display in Invite List'
                        },
                        'c_group_tasks': {
                          'label': 'Task Assignments'
                        },
                        'c_import_id': {
                          'label': 'Import ID'
                        },
                        'c_key': {
                          'label': 'Key'
                        },
                        'c_name': {
                          'label': 'Name'
                        },
                        'c_sequence': {
                          'label': 'Sequence'
                        },
                        'c_study': {
                          'label': 'Study'
                        },
                        'c_televisit_enabled': {
                          'label': 'Enable Televisit'
                        },
                        'c_visits': {
                          'label': 'Visits'
                        }
                      }
                    },
                    'c_group_task': {
                      'label': 'Participant Group Task',
                      'properties': {
                        'c_assignment': {
                          'label': 'Assignment'
                        },
                        'c_end_date': {
                          'label': 'End Date'
                        },
                        'c_end_date_anchor': {
                          'label': 'End Date Anchor',
                          'properties': {
                            'c_offset': {
                              'label': 'Offset'
                            },
                            'c_template': {
                              'label': 'Template'
                            }
                          }
                        },
                        'c_flow_rules': {
                          'label': 'Flow Rules',
                          'properties': {
                            'c_dependency': {
                              'label': 'Dependency'
                            },
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_type': {
                              'label': 'Type'
                            }
                          }
                        },
                        'c_group': {
                          'label': 'Participant Group'
                        },
                        'c_key': {
                          'label': 'Key'
                        },
                        'c_notification_active': {
                          'label': 'Notification Active'
                        },
                        'c_notification_message': {
                          'label': 'Notification Message'
                        },
                        'c_notification_skip': {
                          'label': 'Notification Skip'
                        },
                        'c_notification_times': {
                          'label': 'Notification Times'
                        },
                        'c_order': {
                          'label': 'Order'
                        },
                        'c_required_reviews': {
                          'label': 'Required Reviews'
                        },
                        'c_schedule': {
                          'label': 'Schedule Type'
                        },
                        'c_schedule_value': {
                          'label': 'Schedule Value'
                        },
                        'c_site': {
                          'label': 'Site'
                        },
                        'c_sites': {
                          'label': 'Sites'
                        },
                        'c_start_date': {
                          'label': 'Start Date'
                        },
                        'c_start_date_anchor': {
                          'label': 'Start Date Anchor',
                          'properties': {
                            'c_offset': {
                              'label': 'Offset'
                            },
                            'c_template': {
                              'label': 'Template'
                            }
                          }
                        },
                        'c_use_time_window': {
                          'label': 'Use Time Window'
                        },
                        'c_window_end': {
                          'label': 'Window End'
                        },
                        'c_window_start': {
                          'label': 'Window Start'
                        }
                      }
                    },
                    'c_health_datum': {
                      'label': 'Health Data',
                      'properties': {
                        'c_data': {
                          'label': 'Data'
                        },
                        'c_device': {
                          'label': 'Device'
                        },
                        'c_end': {
                          'label': 'End'
                        },
                        'c_patient': {
                          'label': 'Patient'
                        },
                        'c_source': {
                          'label': 'Source'
                        },
                        'c_start': {
                          'label': 'Start'
                        },
                        'c_subtype': {
                          'label': 'Subtype'
                        },
                        'c_type': {
                          'label': 'Type'
                        },
                        'c_uuid': {
                          'label': 'UUID'
                        },
                        'c_version': {
                          'label': 'Version'
                        }
                      }
                    },
                    'c_missed_task': {
                      'label': 'Missed Task',
                      'properties': {
                        'c_due_after': {
                          'label': 'Due After'
                        },
                        'c_due_before': {
                          'label': 'Due Before'
                        },
                        'c_group_task': {
                          'label': 'Group Task'
                        },
                        'c_public_user': {
                          'label': 'Participant'
                        },
                        'c_site': {
                          'label': 'Site'
                        }
                      }
                    },
                    'c_public_user': {
                      'label': 'Participant',
                      'properties': {
                        'c_access_code': {
                          'label': 'Access Code'
                        },
                        'c_account': {
                          'label': 'Account'
                        },
                        'c_baseline_date': {
                          'label': 'Baseline Date'
                        },
                        'c_caregivers': {
                          'label': 'Caregivers'
                        },
                        'c_connection_id': {
                          'label': 'Connection ID'
                        },
                        'c_email': {
                          'label': 'Email'
                        },
                        'c_enrollment_date': {
                          'label': 'Enrollment Date'
                        },
                        'c_group': {
                          'label': 'Task Group'
                        },
                        'c_invite': {
                          'label': 'Invite Status'
                        },
                        'c_last_invite_time': {
                          'label': 'Last Invite Time'
                        },
                        'c_locale': {
                          'label': 'Locale'
                        },
                        'c_mobile': {
                          'label': 'Mobile'
                        },
                        'c_number': {
                          'label': 'Participant ID'
                        },
                        'c_open_queries': {
                          'label': 'Open Queries'
                        },
                        'c_participant_name_or_email': {
                          'label': 'Participant Name or Email'
                        },
                        'c_pin_expiry_time': {
                          'label': 'Pin Expiry Time'
                        },
                        'c_review_status': {
                          'label': 'Casebook Status'
                        },
                        'c_search': {
                          'label': 'Search'
                        },
                        'c_set_dates': {
                          'label': 'Set Dates',
                          'properties': {
                            'c_date': {
                              'label': 'Date'
                            },
                            'c_template': {
                              'label': 'Template'
                            }
                          }
                        },
                        'c_signatures': {
                          'label': 'Signatures'
                        },
                        'c_site': {
                          'label': 'Site'
                        },
                        'c_start': {
                          'label': 'Start'
                        },
                        'c_state': {
                          'label': 'State'
                        },
                        'c_status': {
                          'label': 'Status'
                        },
                        'c_study': {
                          'label': 'Study'
                        },
                        'c_task_responses': {
                          'label': 'Task Responses'
                        },
                        'c_type': {
                          'label': 'Type'
                        },
                        'c_tz': {
                          'label': 'Time Zone'
                        },
                        'c_username': {
                          'label': 'Username'
                        },
                        'c_visit_events': {
                          'label': 'Visit Events'
                        },
                        'c_visit_schedule': {
                          'label': 'Visit Schedule'
                        }
                      }
                    },
                    'c_query': {
                      'label': 'Query',
                      'properties': {
                        'c_closed_by': {
                          'label': 'Closed By'
                        },
                        'c_closed_datetime': {
                          'label': 'Closed Datetime'
                        },
                        'c_closing_reason': {
                          'label': 'Closing Reason'
                        },
                        'c_description': {
                          'label': 'Message'
                        },
                        'c_manually_closed': {
                          'label': 'Manually Closed'
                        },
                        'c_notes': {
                          'label': 'Notes'
                        },
                        'c_number': {
                          'label': 'Number'
                        },
                        'c_query_rule': {
                          'label': 'Query Rule'
                        },
                        'c_responded_by': {
                          'label': 'Responded By'
                        },
                        'c_responded_datetime': {
                          'label': 'Responded Datetime'
                        },
                        'c_response': {
                          'label': 'Response'
                        },
                        'c_search': {
                          'label': 'Search'
                        },
                        'c_site': {
                          'label': 'Site'
                        },
                        'c_status': {
                          'label': 'Status'
                        },
                        'c_step_response': {
                          'label': 'Step Response'
                        },
                        'c_study': {
                          'label': 'Study'
                        },
                        'c_subject': {
                          'label': 'Participant'
                        },
                        'c_task_response': {
                          'label': 'Task Response'
                        },
                        'c_type': {
                          'label': 'Type'
                        }
                      }
                    },
                    'c_query_note': {
                      'label': 'Query Note',
                      'properties': {
                        'c_note': {
                          'label': 'Note'
                        },
                        'c_query': {
                          'label': 'Query'
                        }
                      }
                    },
                    'c_query_rule': {
                      'label': 'Query Rule',
                      'properties': {
                        'c_key': {
                          'label': 'Key'
                        },
                        'c_message': {
                          'label': 'Message'
                        },
                        'c_name': {
                          'label': 'Name'
                        },
                        'c_relevant_steps': {
                          'label': 'c_relevant_steps'
                        },
                        'c_rules': {
                          'label': 'Rules'
                        },
                        'c_target_field': {
                          'label': 'Target Field'
                        },
                        'c_task': {
                          'label': 'Task'
                        },
                        'c_variables': {
                          'label': 'Variables'
                        }
                      }
                    },
                    'c_research_datum': {
                      'label': 'Research Data',
                      'properties': {
                        'c_datetime': {
                          'label': 'Date/Time'
                        },
                        'c_study': {
                          'label': 'Study'
                        },
                        'c_type': {
                          'label': 'Type'
                        },
                        'c_value': {
                          'label': 'Value'
                        }
                      }
                    },
                    'c_site': {
                      'label': 'Site',
                      'properties': {
                        'c_addresses': {
                          'label': 'Addresses',
                          'properties': {
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_line': {
                              'label': 'Line'
                            },
                            'c_type': {
                              'label': 'Type'
                            }
                          }
                        },
                        'c_contacts': {
                          'label': 'Contacts',
                          'properties': {
                            'c_contact': {
                              'label': 'Contact'
                            },
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_type': {
                              'label': 'Type'
                            }
                          }
                        },
                        'c_country': {
                          'label': 'Country'
                        },
                        'c_key': {
                          'label': 'Key'
                        },
                        'c_locks': {
                          'label': 'Locks'
                        },
                        'c_missed_tasks': {
                          'label': 'Missed Tasks'
                        },
                        'c_name': {
                          'label': 'Name'
                        },
                        'c_number': {
                          'label': 'Number'
                        },
                        'c_pi_name': {
                          'label': 'Principal Investigator Name'
                        },
                        'c_queries': {
                          'label': 'Queries'
                        },
                        'c_site_users': {
                          'label': 'Site Users'
                        },
                        'c_study': {
                          'label': 'Study'
                        },
                        'c_subjects': {
                          'label': 'Participants'
                        },
                        'c_supported_locales': {
                          'label': 'Supported Locales'
                        },
                        'c_task_responses': {
                          'label': 'Task Responses'
                        }
                      }
                    },
                    'c_site_user': {
                      'label': 'Site User',
                      'properties': {
                        'c_account': {
                          'label': 'Account'
                        },
                        'c_role': {
                          'label': 'Role'
                        },
                        'c_site': {
                          'label': 'Site'
                        }
                      }
                    },
                    'c_step': {
                      'label': 'Step',
                      'properties': {
                        'c_accessibility_hint': {
                          'label': 'Accessibility Hint'
                        },
                        'c_accessibility_instructions': {
                          'label': 'Accessibility Instructions'
                        },
                        'c_account_map': {
                          'label': 'Account Map'
                        },
                        'c_allow_multiples': {
                          'label': 'Allow Multiples'
                        },
                        'c_assets': {
                          'label': 'Assets',
                          'properties': {
                            'c_file': {
                              'label': 'File'
                            },
                            'c_identifier': {
                              'label': 'Identifier'
                            },
                            'c_key': {
                              'label': 'Key'
                            }
                          }
                        },
                        'c_calendar': {
                          'label': 'Calendar'
                        },
                        'c_camera': {
                          'label': 'Camera'
                        },
                        'c_cdash_domain': {
                          'label': 'CDASH Domain'
                        },
                        'c_completion_text_list': {
                          'label': 'Completion Text List'
                        },
                        'c_completion_text_list_restrict': {
                          'label': 'Completion Text List Restriction'
                        },
                        'c_content_url': {
                          'label': 'Content URL'
                        },
                        'c_date_only': {
                          'label': 'Date Only'
                        },
                        'c_default': {
                          'label': 'Default'
                        },
                        'c_default_date': {
                          'label': 'Default Date'
                        },
                        'c_default_hour': {
                          'label': 'Default Hour'
                        },
                        'c_default_index': {
                          'label': 'Default Index'
                        },
                        'c_default_interval': {
                          'label': 'Default Interval'
                        },
                        'c_default_minute': {
                          'label': 'Default Minute'
                        },
                        'c_default_value': {
                          'label': 'Default Value'
                        },
                        'c_description': {
                          'label': 'Description'
                        },
                        'c_disabled': {
                          'label': 'Disabled'
                        },
                        'c_document_section': {
                          'label': 'Document Section'
                        },
                        'c_document_title': {
                          'label': 'Document Title'
                        },
                        'c_form_steps': {
                          'label': 'Form Steps'
                        },
                        'c_formal_title': {
                          'label': 'Formal Title'
                        },
                        'c_fraction_digit': {
                          'label': 'Fraction Digit'
                        },
                        'c_get_air_quality_data': {
                          'label': 'Get Air Quality Data'
                        },
                        'c_google_fit_permissions': {
                          'label': 'Google Fit Permissions',
                          'properties': {
                            'c_include_historical': {
                              'label': 'Include Historical'
                            },
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_order': {
                              'label': 'Order'
                            },
                            'c_read_write_type': {
                              'label': 'Read Write Type'
                            },
                            'c_sub_type': {
                              'label': 'Sub Type'
                            },
                            'c_type': {
                              'label': 'Type'
                            },
                            'c_use_decimal': {
                              'label': 'Use Decimal'
                            }
                          }
                        },
                        'c_hidden': {
                          'label': 'Hidden'
                        },
                        'c_html_content': {
                          'label': 'HTML Content'
                        },
                        'c_image': {
                          'label': 'Image File'
                        },
                        'c_image_choices': {
                          'label': 'Image Choices',
                          'properties': {
                            'c_image': {
                              'label': 'Image File'
                            },
                            'c_image_file': {
                              'label': 'Image File'
                            },
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_name': {
                              'label': 'Name'
                            },
                            'c_order': {
                              'label': 'Order'
                            },
                            'c_text': {
                              'label': 'Text'
                            },
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_image_insets': {
                          'label': 'Image Insets'
                        },
                        'c_import_id': {
                          'label': 'Import ID'
                        },
                        'c_instructions': {
                          'label': 'Instructions'
                        },
                        'c_invalid_message': {
                          'label': 'Invalid Message'
                        },
                        'c_key': {
                          'label': 'Key'
                        },
                        'c_learn_more_button': {
                          'label': 'Custom Learn More Button Title'
                        },
                        'c_mappings': {
                          'label': 'Mappings',
                          'properties': {
                            'c_category': {
                              'label': 'Category'
                            },
                            'c_cdash': {
                              'label': 'CDASH'
                            },
                            'c_domain': {
                              'label': 'Domain'
                            }
                          }
                        },
                        'c_match_anywhere': {
                          'label': 'Match Anywhere'
                        },
                        'c_maximum': {
                          'label': 'Maximum'
                        },
                        'c_maximum_date': {
                          'label': 'Maximum Date'
                        },
                        'c_maximum_description': {
                          'label': 'Maximum Description'
                        },
                        'c_maximum_fraction_digit': {
                          'label': 'Maximum Fraction Digit'
                        },
                        'c_maximum_length': {
                          'label': 'Maximum Length'
                        },
                        'c_minimum': {
                          'label': 'Minimum'
                        },
                        'c_minimum_date': {
                          'label': 'Minimum Date'
                        },
                        'c_minimum_description': {
                          'label': 'Minimum Description'
                        },
                        'c_multiple_lines': {
                          'label': 'Multiple Lines'
                        },
                        'c_name': {
                          'label': 'Name'
                        },
                        'c_no_completion_image': {
                          'label': 'No Completion Image'
                        },
                        'c_omit_from_doc': {
                          'label': 'Omit from Document'
                        },
                        'c_optional': {
                          'label': 'Optional'
                        },
                        'c_order': {
                          'label': 'Order'
                        },
                        'c_original_item': {
                          'label': 'Original Item'
                        },
                        'c_original_step': {
                          'label': 'Original Step'
                        },
                        'c_parent': {
                          'label': 'Parent'
                        },
                        'c_parent_step': {
                          'label': 'Parent Step'
                        },
                        'c_placeholder': {
                          'label': 'Placeholder'
                        },
                        'c_quantity_types': {
                          'label': 'Quantity Types',
                          'properties': {
                            'c_include_historical': {
                              'label': 'Include Historical'
                            },
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_order': {
                              'label': 'Order'
                            },
                            'c_read_write_type': {
                              'label': 'Read/Write Type'
                            },
                            'c_sub_type': {
                              'label': 'Sub Type'
                            },
                            'c_type': {
                              'label': 'Type'
                            },
                            'c_unit': {
                              'label': 'Unit'
                            },
                            'c_use_decimal': {
                              'label': 'Use Decimal'
                            }
                          }
                        },
                        'c_question': {
                          'label': 'Question'
                        },
                        'c_require_validation': {
                          'label': 'Require Validation'
                        },
                        'c_result_type': {
                          'label': 'Result Type'
                        },
                        'c_secure_text_entry': {
                          'label': 'Secure Text Entry'
                        },
                        'c_step_size': {
                          'label': 'Step Size'
                        },
                        'c_style': {
                          'label': 'Style'
                        },
                        'c_success': {
                          'label': 'Success'
                        },
                        'c_task': {
                          'label': 'Task'
                        },
                        'c_text': {
                          'label': 'Text'
                        },
                        'c_text_choices': {
                          'label': 'Text Choices',
                          'properties': {
                            'c_description': {
                              'label': 'Description'
                            },
                            'c_exclusive': {
                              'label': 'Exclusive'
                            },
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_order': {
                              'label': 'Order'
                            },
                            'c_text': {
                              'label': 'Display Text'
                            },
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_type': {
                          'label': 'Type'
                        },
                        'c_unit': {
                          'label': 'Unit'
                        },
                        'c_use_current_location': {
                          'label': 'Use Current Location'
                        },
                        'c_validation_regex': {
                          'label': 'Validation Regex'
                        },
                        'c_validation_type': {
                          'label': 'Validation Type'
                        },
                        'c_vertical': {
                          'label': 'Vertical'
                        },
                        'c_visible': {
                          'label': 'Visible'
                        }
                      }
                    },
                    'c_step_response': {
                      'label': 'Step Response',
                      'objectTypes': {
                        'c_active_task': {
                          'label': 'Active Task',
                          'properties': {
                            'c_value': {
                              'label': 'Value',
                              'properties': {
                                'c_file': {
                                  'label': 'File'
                                },
                                'c_filename': {
                                  'label': 'Filename'
                                },
                                'c_identifier': {
                                  'label': 'Ientifier'
                                }
                              }
                            }
                          }
                        },
                        'c_barcode_scanner': {
                          'label': 'Barcode Scanner',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_boolean': {
                          'label': 'Boolean',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_completion': {
                          'label': 'Completion',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_consent': {
                          'label': 'Consent',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_consent_review': {
                          'label': 'Consent Review',
                          'properties': {
                            'c_file': {
                              'label': 'File'
                            },
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_continuous_scale': {
                          'label': 'Continuous Scale',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_date': {
                          'label': 'Date',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_datetime': {
                          'label': 'Datetime',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_email': {
                          'label': 'Email',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_image_capture': {
                          'label': 'Image Capture',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_image_choice': {
                          'label': 'Image Choice',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_instruction': {
                          'label': 'Instruction',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_integer_scale': {
                          'label': 'Integer Scale',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_location': {
                          'label': 'Location',
                          'properties': {
                            'c_data': {
                              'label': 'Data'
                            },
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_nucleus_question_review': {
                          'label': 'Question Review',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_numeric': {
                          'label': 'Numeric',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_text': {
                          'label': 'Text',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_text_choice': {
                          'label': 'Text Choice',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_text_scale': {
                          'label': 'Text Scale',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_time_interval': {
                          'label': 'Time Interval',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_time_of_day': {
                          'label': 'Time of Day',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        },
                        'c_value_picker': {
                          'label': 'Value Picker',
                          'properties': {
                            'c_value': {
                              'label': 'Value'
                            }
                          }
                        }
                      },
                      'properties': {
                        'c_account': {
                          'label': 'Account'
                        },
                        'c_cdash_variable': {
                          'label': 'CDASH Variable'
                        },
                        'c_completion_instructions': {
                          'label': 'Completion Instructions'
                        },
                        'c_end_date': {
                          'label': 'End Date'
                        },
                        'c_group': {
                          'label': 'Task Group'
                        },
                        'c_public_user': {
                          'label': 'Participant'
                        },
                        'c_queries': {
                          'label': 'Queries'
                        },
                        'c_site': {
                          'label': 'Site'
                        },
                        'c_skipped': {
                          'label': 'Skipped'
                        },
                        'c_start_date': {
                          'label': 'Start Date'
                        },
                        'c_step': {
                          'label': 'Step'
                        },
                        'c_study': {
                          'label': 'Study'
                        },
                        'c_task': {
                          'label': 'Task'
                        },
                        'c_task_response': {
                          'label': 'Task Response'
                        },
                        'c_visit': {
                          'label': 'Visit'
                        }
                      }
                    },
                    'c_study': {
                      'label': 'Study',
                      'properties': {
                        'c_all_tasks': {
                          'label': 'All Tasks'
                        },
                        'c_anchor_date_templates': {
                          'label': 'Anchor Date Templates'
                        },
                        'c_auth_task_fields': {
                          'label': 'Auth Task Fields'
                        },
                        'c_code': {
                          'label': 'Code Name'
                        },
                        'c_configuration': {
                          'label': 'Configuration',
                          'properties': {
                            'c_action_failed_color': {
                              'label': 'Action Failed Color'
                            },
                            'c_callout_color': {
                              'label': 'Callout Color'
                            },
                            'c_consent': {
                              'label': 'Gradient Principal'
                            },
                            'c_gradient_principal': {
                              'label': 'Gradient Principal'
                            },
                            'c_gradient_secondary': {
                              'label': 'Gradient Secondary'
                            },
                            'c_organization_logo': {
                              'label': 'Organization Logo'
                            },
                            'c_principal_color': {
                              'label': 'Principal Color'
                            },
                            'c_principal_text_color': {
                              'label': 'Principal Text Color'
                            },
                            'c_receive_notifications': {
                              'label': 'Receive Notifications'
                            },
                            'c_secondary_color': {
                              'label': 'Secondary Color'
                            },
                            'c_secondary_text_color': {
                              'label': 'Secondary Text Color'
                            },
                            'c_study_logo': {
                              'label': 'Study Logo'
                            }
                          }
                        },
                        'c_default_subject_group': {
                          'label': 'Default Participant Group'
                        },
                        'c_default_subject_site': {
                          'label': 'Default Participant Site'
                        },
                        'c_default_subject_visit_schedule': {
                          'label': 'Default Participant Visit Schedule'
                        },
                        'c_description': {
                          'label': 'Description'
                        },
                        'c_enable_alt_reg': {
                          'label': 'Enable Alternate Registration'
                        },
                        'c_end_date': {
                          'label': 'End Date'
                        },
                        'c_exports': {
                          'label': 'Exports'
                        },
                        'c_field': {
                          'label': 'Field of Study'
                        },
                        'c_forgot_username_options': {
                          'label': 'Forgot Username Options'
                        },
                        'c_format_spec_queries': {
                          'label': 'Format Spec Queries'
                        },
                        'c_format_spec_sites': {
                          'label': 'Format Spec Sites'
                        },
                        'c_format_spec_subject_id': {
                          'label': 'Format Spec Participant ID'
                        },
                        'c_format_spec_tasks': {
                          'label': 'Format Spec Tasks'
                        },
                        'c_goal': {
                          'label': 'Participant Goal'
                        },
                        'c_groups': {
                          'label': 'Groups'
                        },
                        'c_information': {
                          'label': 'Information',
                          'properties': {
                            'c_assets': {
                              'label': 'Assets'
                            },
                            'c_content': {
                              'label': 'Content'
                            },
                            'c_content_is_html': {
                              'label': 'Content is HTML'
                            },
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_title': {
                              'label': 'Title'
                            },
                            'c_web_link': {
                              'label': 'Web Link'
                            }
                          }
                        },
                        'c_invite_code_ttl': {
                          'label': 'Invite Code TTL'
                        },
                        'c_key': {
                          'label': 'Key'
                        },
                        'c_localized_faults': {
                          'label': 'Localized Faults'
                        },
                        'c_menu_config': {
                          'label': 'Menu Config',
                          'properties': {
                            'c_display_name': {
                              'label': 'Display Name'
                            },
                            'c_group_id': {
                              'label': 'Group Id'
                            },
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_menu': {
                              'label': 'Menu'
                            }
                          }
                        },
                        'c_name': {
                          'label': 'Name'
                        },
                        'c_patient_app_display_options': {
                          'label': 'Patient App Display Options',
                          'properties': {
                            'c_profile_fields': {
                              'label': 'Profile Fields'
                            },
                            'c_show_consent_documents': {
                              'label': 'Show Consent Documents'
                            },
                            'c_show_language_selector': {
                              'label': 'Show Language Selector'
                            },
                            'c_show_leave_study': {
                              'label': 'Show Leave Study'
                            },
                            'c_show_site_information': {
                              'label': 'Show Site Information'
                            },
                            'c_show_subject_number': {
                              'label': 'Show Subject Number'
                            }
                          }
                        },
                        'c_privacy_items': {
                          'label': 'Privacy Items',
                          'properties': {
                            'c_apps': {
                              'label': 'Apps'
                            },
                            'c_html_content': {
                              'label': 'HTML Content'
                            },
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_label': {
                              'label': 'Name'
                            },
                            'c_url': {
                              'label': 'URL'
                            }
                          }
                        },
                        'c_protocol_number': {
                          'label': 'Protocol Number'
                        },
                        'c_public_group': {
                          'label': 'Public Group'
                        },
                        'c_queries': {
                          'label': 'Queries'
                        },
                        'c_reasons_for_change': {
                          'label': 'Reasons For Change'
                        },
                        'c_requires_invite': {
                          'label': 'Requires Invite'
                        },
                        'c_resources': {
                          'label': 'Resources',
                          'properties': {
                            'c_assets': {
                              'label': 'Assets'
                            },
                            'c_content': {
                              'label': 'Content'
                            },
                            'c_content_is_html': {
                              'label': 'Content is HTML'
                            },
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_title': {
                              'label': 'Title'
                            },
                            'c_web_link': {
                              'label': 'Web Link'
                            }
                          }
                        },
                        'c_review_types': {
                          'label': 'Review Types',
                          'properties': {
                            'c_active': {
                              'label': 'Active'
                            },
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_name': {
                              'label': 'Name'
                            },
                            'c_roles': {
                              'label': 'Roles'
                            }
                          }
                        },
                        'c_sites': {
                          'label': 'Sites'
                        },
                        'c_sponsor_name': {
                          'label': 'Study Contact Information'
                        },
                        'c_start_date': {
                          'label': 'Start Date'
                        },
                        'c_step_responses': {
                          'label': 'Step Responses'
                        },
                        'c_store_invite_data': {
                          'label': 'Store Invite Data'
                        },
                        'c_study_team_users': {
                          'label': 'Study Team Users'
                        },
                        'c_subject_enrollment_status': {
                          'label': 'Participant Enrollment status'
                        },
                        'c_subject_invite_validation': {
                          'label': 'Participant Invite Validation'
                        },
                        'c_subject_menu_config': {
                          'label': 'Participant Menu Config',
                          'properties': {
                            'c_button_title': {
                              'label': 'Button Title'
                            },
                            'c_column_props': {
                              'label': 'Column Props'
                            },
                            'c_columns': {
                              'label': 'Columns'
                            },
                            'c_key': {
                              'label': 'Key'
                            },
                            'c_long_name': {
                              'label': 'Long Name'
                            },
                            'c_short_name': {
                              'label': 'Short Name'
                            },
                            'c_task_id': {
                              'label': 'Task Id'
                            }
                          }
                        },
                        'c_subject_status_list': {
                          'label': 'Participant Status List',
                          'properties': {
                            'c_status_value': {
                              'label': 'Status Value'
                            }
                          }
                        },
                        'c_supported_locales': {
                          'label': 'Supported Locales'
                        },
                        'c_task_responses': {
                          'label': 'Task Responses'
                        },
                        'c_tasks': {
                          'label': 'Tasks'
                        },
                        'c_televisit_enabled': {
                          'label': 'Televisit Enabled'
                        },
                        'c_visit_schedules': {
                          'label': 'Visit Schedules'
                        }
                      }
                    },
                    'c_study_export': {
                      'label': 'Study Export',
                      'properties': {
                        'c_export': {
                          'label': 'Export'
                        },
                        'c_study': {
                          'label': 'Study'
                        },
                        'c_type': {
                          'label': 'Type'
                        }
                      }
                    },
                    'c_study_team_user': {
                      'label': 'Study Team User',
                      'properties': {
                        'c_account': {
                          'label': 'Account'
                        },
                        'c_role': {
                          'label': 'Role'
                        },
                        'c_study': {
                          'label': 'Study'
                        }
                      }
                    },
                    'c_task': {
                      'label': 'Task',
                      'properties': {
                        'c_accelerometer': {
                          'label': 'Accelerometer'
                        },
                        'c_active_type': {
                          'label': 'Active Type'
                        },
                        'c_audio': {
                          'label': 'Audio'
                        },
                        'c_branches': {
                          'label': 'Branches'
                        },
                        'c_category': {
                          'label': 'Category'
                        },
                        'c_cloning_flag': {
                          'label': 'Cloning Flag'
                        },
                        'c_code': {
                          'label': 'Code Name'
                        },
                        'c_conclusion': {
                          'label': 'Conclusion'
                        },
                        'c_consent_appendix': {
                          'label': 'Consent Appendix'
                        },
                        'c_consent_cover_html': {
                          'label': 'Consent Cover Html'
                        },
                        'c_consent_hcp_statement': {
                          'label': 'Consent HCP Statement'
                        },
                        'c_consent_type': {
                          'label': 'Consent Type'
                        },
                        'c_description': {
                          'label': 'Description'
                        },
                        'c_device_motion': {
                          'label': 'Device Motion'
                        },
                        'c_dominant_left': {
                          'label': 'Dominant Left'
                        },
                        'c_duration': {
                          'label': 'Duration'
                        },
                        'c_eligibility_condition': {
                          'label': 'Eligibility Condition'
                        },
                        'c_groups': {
                          'label': 'Participant Groups'
                        },
                        'c_heart_rate': {
                          'label': 'Heart Rate'
                        },
                        'c_html_review_content': {
                          'label': 'HTML Review Content'
                        },
                        'c_import_id': {
                          'label': 'Import ID'
                        },
                        'c_include_in_report': {
                          'label': 'Include in missing data report'
                        },
                        'c_instructions': {
                          'label': 'Instructions'
                        },
                        'c_intended_use': {
                          'label': 'Intended Use'
                        },
                        'c_key': {
                          'label': 'Key'
                        },
                        'c_location': {
                          'label': 'Location'
                        },
                        'c_name': {
                          'label': 'Name'
                        },
                        'c_number_of_disks': {
                          'label': 'Number Of Disks'
                        },
                        'c_number_of_pegs': {
                          'label': 'Number Of Pegs'
                        },
                        'c_number_of_steps_per_leg': {
                          'label': 'Number Of Steps Per Leg'
                        },
                        'c_pedometer': {
                          'label': 'Pedometer'
                        },
                        'c_record_settings': {
                          'label': 'Record Settings'
                        },
                        'c_requires_subject': {
                          'label': 'Requires Participant'
                        },
                        'c_response_validity_period_unit': {
                          'label': 'Response Validity Period Unit'
                        },
                        'c_response_validity_period_value': {
                          'label': 'Response Validity Period Value'
                        },
                        'c_rest_duration': {
                          'label': 'Rest Duration'
                        },
                        'c_rotated': {
                          'label': 'Rotated'
                        },
                        'c_sdm_review_required': {
                          'label': 'Source Data Manager Review Required'
                        },
                        'c_self_assessment': {
                          'label': 'Self Assessment'
                        },
                        'c_set_subject_status_failure': {
                          'label': 'Set Participant Status Failure'
                        },
                        'c_set_subject_status_success': {
                          'label': 'Set Participant Status Success'
                        },
                        'c_short_speech_instruction': {
                          'label': 'Short Speech Instruction'
                        },
                        'c_speech_instruction': {
                          'label': 'Speech Instruction'
                        },
                        'c_steps': {
                          'label': 'Steps'
                        },
                        'c_study': {
                          'label': 'Study'
                        },
                        'c_survey_schedule_unit': {
                          'label': 'Survey Schedule Unit'
                        },
                        'c_survey_schedule_value': {
                          'label': 'Survey Schedule Value'
                        },
                        'c_threshold': {
                          'label': 'Threshold'
                        },
                        'c_time_limit': {
                          'label': 'Time Limit'
                        },
                        'c_type': {
                          'label': 'Type'
                        },
                        'c_use_as_template': {
                          'label': 'Use as Template'
                        },
                        'c_validated_instrument': {
                          'label': 'Validated Instrument',
                          'properties': {
                            'c_vi_html_footer': {
                              'label': 'VI HTML Footer'
                            },
                            'c_vi_html_header': {
                              'label': 'VI HTML Header'
                            }
                          }
                        },
                        'c_visits': {
                          'label': 'Visits'
                        },
                        'c_walk_duration': {
                          'label': 'Walk Duration'
                        }
                      }
                    },
                    'c_task_response': {
                      'label': 'Task Response',
                      'properties': {
                        'c_account': {
                          'label': 'Account'
                        },
                        'c_clean_status': {
                          'label': 'Clean Status'
                        },
                        'c_completed': {
                          'label': 'Completed'
                        },
                        'c_data_manager_review': {
                          'label': 'Data Manager Review'
                        },
                        'c_end': {
                          'label': 'End'
                        },
                        'c_group': {
                          'label': 'Group'
                        },
                        'c_inactive': {
                          'label': 'Inactive'
                        },
                        'c_locale': {
                          'label': 'Number'
                        },
                        'c_number': {
                          'label': 'Number'
                        },
                        'c_public_user': {
                          'label': 'Participant'
                        },
                        'c_queries': {
                          'label': 'Queries'
                        },
                        'c_reviews': {
                          'label': 'Reviews'
                        },
                        'c_site': {
                          'label': 'Site'
                        },
                        'c_start': {
                          'label': 'Start'
                        },
                        'c_status': {
                          'label': 'Status'
                        },
                        'c_step_responses': {
                          'label': 'Step Responses'
                        },
                        'c_study': {
                          'label': 'Study'
                        },
                        'c_success': {
                          'label': 'Success'
                        },
                        'c_task': {
                          'label': 'Task'
                        },
                        'c_tz': {
                          'label': 'Time Zone'
                        },
                        'c_uuid': {
                          'label': 'UUID'
                        },
                        'c_visit': {
                          'label': 'Visit'
                        }
                      }
                    },
                    'c_visit': {
                      'label': 'Visit',
                      'properties': {
                        'c_anchor_date': {
                          'label': 'Anchor Date'
                        },
                        'c_groups': {
                          'label': 'Groups'
                        },
                        'c_key': {
                          'label': 'Key'
                        },
                        'c_name': {
                          'label': 'Name'
                        },
                        'c_schedule': {
                          'label': 'Schedule',
                          'properties': {
                            'c_days_from_start': {
                              'label': 'Days From Start'
                            },
                            'c_minus': {
                              'label': 'Minus'
                            },
                            'c_plus': {
                              'label': 'Plus'
                            }
                          }
                        },
                        'c_visit_schedules': {
                          'label': 'Visit Schedules'
                        }
                      }
                    },
                    'c_visit_schedule': {
                      'label': 'Visit Schedule',
                      'properties': {
                        'c_default_anchor_date': {
                          'label': 'Default Anchor Date'
                        },
                        'c_key': {
                          'label': 'Key'
                        },
                        'c_name': {
                          'label': 'Name'
                        },
                        'c_study': {
                          'label': 'Study'
                        },
                        'c_visits': {
                          'label': 'Visits'
                        }
                      }
                    },
                    'org': {
                      'label': 'Organization',
                      'properties': {
                        'c_pin': {
                          'label': 'Pin'
                        }
                      }
                    },
                    'c_review': {
                      'label': 'Review',
                      'properties': {
                        'c_date': {
                          'label': 'Date'
                        },
                        'c_invalidated_at': {
                          'label': 'Invalidated At'
                        },
                        'c_review_type': {
                          'label': 'Review Type'
                        },
                        'c_reviewer': {
                          'label': 'Reviewer'
                        },
                        'c_task_response': {
                          'label': 'Task Response'
                        }
                      }
                    },
                    'c_lock': {
                      'label': 'Lock',
                      'properties': {
                        'c_active': {
                          'label': 'Active'
                        },
                        'c_item': {
                          'label': 'Item'
                        },
                        'c_locked_object_id': {
                          'label': 'Locked Object Id'
                        },
                        'c_locked_object_type': {
                          'label': 'Locked Object Type'
                        },
                        'c_site': {
                          'label': 'Site'
                        },
                        'c_snapshot_date': {
                          'label': 'Snapshot Date'
                        },
                        'c_type': {
                          'label': 'Type'
                        }
                      }
                    },
                    'c_anchor_date_template': {
                      'label': 'Anchor Date Template',
                      'properties': {
                        'c_date_time_step': {
                          'label': 'Date Time Step'
                        },
                        'c_identifier': {
                          'label': 'Anchor Date Name'
                        },
                        'c_key': {
                          'label': 'Key'
                        },
                        'c_static_date': {
                          'label': 'Static Date'
                        },
                        'c_study': {
                          'label': 'Study'
                        },
                        'c_task_completion': {
                          'label': 'Task Completion'
                        },
                        'c_type': {
                          'label': 'Type'
                        }
                      }
                    }
                  }
                },
                'locale': 'en_US',
                'name': 'axon__en_US_objects',
                'namespace': 'axon',
                'object': 'i18n',
                'tags': [],
                'weight': 0
              }
            ]
      return environment.import(data, { backup: false, triggers: false }).toArray()

    }))

    const result = await promised(null, sandboxed(function() {
      /* global org */
      return org.objects.i18n.find().skipAcl().grant(4).next()
    }))

    should.exist(result)
    should(result.locale).equal('en_US')

  })

  it('i18n object should be exported properly', async function() {

    await promised(null, sandboxed(function() {
      // create templates
      /* global org */
      const data = {
        'data': {
          'object': {
            'account': {
              'label': 'Account',
              'properties': {
                'c_enrollments': {
                  'label': 'Enrollments',
                  'properties': {
                    'c_group': {
                      'label': 'Group'
                    },
                    'c_joined': {
                      'label': 'Joined'
                    },
                    'c_left': {
                      'label': 'Left'
                    },
                    'c_study': {
                      'label': 'Study'
                    }
                  }
                },
                'c_health_data': {
                  'label': 'Health Data'
                },
                'c_public_identifier': {
                  'label': 'Public Identifier'
                },
                'c_public_users': {
                  'label': 'Participants'
                },
                'c_site_app_settings': {
                  'label': 'Site App Settings',
                  'properties': {
                    'c_pin': {
                      'label': 'c_pin'
                    }
                  }
                },
                'c_study_groups': {
                  'label': 'Study Groups'
                },
                'c_sites': {
                  'label': 'Sites'
                }
              }
            },
            'c_branch': {
              'label': 'Branch',
              'properties': {
                'c_conditions': {
                  'label': 'Conditions',
                  'properties': {
                    'c_destination': {
                      'label': 'Destination'
                    },
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_operators': {
                      'label': 'Operators'
                    },
                    'c_order': {
                      'label': 'Order'
                    },
                    'c_selector': {
                      'label': 'Selector'
                    },
                    'c_values': {
                      'label': 'Values'
                    }
                  }
                },
                'c_default_destination': {
                  'label': 'Default Destination'
                },
                'c_key': {
                  'label': 'Key'
                },
                'c_name': {
                  'label': 'Name'
                },
                'c_task': {
                  'label': 'Task'
                },
                'c_trigger': {
                  'label': 'Trigger'
                }
              }
            },
            'c_call': {
              'label': 'Call',
              'properties': {
                'c_public_user': {
                  'label': 'Participant'
                },
                'c_room': {
                  'label': 'Room'
                },
                'c_site': {
                  'label': 'Site'
                },
                'c_status': {
                  'label': 'Status'
                }
              }
            },
            'c_event': {
              'label': 'Event',
              'objectTypes': {
                'c_televisit_event': {
                  'properties': {
                    'c_canceled': {
                      'label': 'Canceled'
                    },
                    'c_group': {
                      'label': 'Group'
                    },
                    'c_reminders': {
                      'label': 'Reminder Type'
                    }
                  }
                }
              },
              'properties': {
                'c_end': {
                  'label': 'End'
                },
                'c_public_user': {
                  'label': 'Participant'
                },
                'c_start': {
                  'label': 'Start'
                },
                'c_timezone': {
                  'label': 'Timezone'
                },
                'c_title': {
                  'label': 'Title'
                }
              }
            },
            'c_fault': {
              'label': 'Fault',
              'properties': {
                'c_detail_code': {
                  'label': 'Detail Code'
                },
                'c_error_code': {
                  'label': 'Error Code'
                },
                'c_key': {
                  'label': 'Key'
                },
                'c_message': {
                  'label': 'Message'
                },
                'c_namespace': {
                  'label': 'Namespace'
                },
                'c_native_code': {
                  'label': 'Native Code'
                },
                'c_reason': {
                  'label': 'Reason'
                }
              }
            },
            'c_group': {
              'label': 'Participant Group',
              'properties': {
                'c_description': {
                  'description': 'A human friendly description of the group, for display in study builder.',
                  'label': 'Description'
                },
                'c_display_in_invite_list': {
                  'label': 'Display in Invite List'
                },
                'c_group_tasks': {
                  'label': 'Task Assignments'
                },
                'c_import_id': {
                  'label': 'Import ID'
                },
                'c_key': {
                  'label': 'Key'
                },
                'c_name': {
                  'label': 'Name'
                },
                'c_sequence': {
                  'label': 'Sequence'
                },
                'c_study': {
                  'label': 'Study'
                },
                'c_televisit_enabled': {
                  'label': 'Enable Televisit'
                },
                'c_visits': {
                  'label': 'Visits'
                }
              }
            },
            'c_group_task': {
              'label': 'Participant Group Task',
              'properties': {
                'c_assignment': {
                  'label': 'Assignment'
                },
                'c_end_date': {
                  'label': 'End Date'
                },
                'c_end_date_anchor': {
                  'label': 'End Date Anchor',
                  'properties': {
                    'c_offset': {
                      'label': 'Offset'
                    },
                    'c_template': {
                      'label': 'Template'
                    }
                  }
                },
                'c_flow_rules': {
                  'label': 'Flow Rules',
                  'properties': {
                    'c_dependency': {
                      'label': 'Dependency'
                    },
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_type': {
                      'label': 'Type'
                    }
                  }
                },
                'c_group': {
                  'label': 'Participant Group'
                },
                'c_key': {
                  'label': 'Key'
                },
                'c_notification_active': {
                  'label': 'Notification Active'
                },
                'c_notification_message': {
                  'label': 'Notification Message'
                },
                'c_notification_skip': {
                  'label': 'Notification Skip'
                },
                'c_notification_times': {
                  'label': 'Notification Times'
                },
                'c_order': {
                  'label': 'Order'
                },
                'c_required_reviews': {
                  'label': 'Required Reviews'
                },
                'c_schedule': {
                  'label': 'Schedule Type'
                },
                'c_schedule_value': {
                  'label': 'Schedule Value'
                },
                'c_site': {
                  'label': 'Site'
                },
                'c_sites': {
                  'label': 'Sites'
                },
                'c_start_date': {
                  'label': 'Start Date'
                },
                'c_start_date_anchor': {
                  'label': 'Start Date Anchor',
                  'properties': {
                    'c_offset': {
                      'label': 'Offset'
                    },
                    'c_template': {
                      'label': 'Template'
                    }
                  }
                },
                'c_use_time_window': {
                  'label': 'Use Time Window'
                },
                'c_window_end': {
                  'label': 'Window End'
                },
                'c_window_start': {
                  'label': 'Window Start'
                }
              }
            },
            'c_health_datum': {
              'label': 'Health Data',
              'properties': {
                'c_data': {
                  'label': 'Data'
                },
                'c_device': {
                  'label': 'Device'
                },
                'c_end': {
                  'label': 'End'
                },
                'c_patient': {
                  'label': 'Patient'
                },
                'c_source': {
                  'label': 'Source'
                },
                'c_start': {
                  'label': 'Start'
                },
                'c_subtype': {
                  'label': 'Subtype'
                },
                'c_type': {
                  'label': 'Type'
                },
                'c_uuid': {
                  'label': 'UUID'
                },
                'c_version': {
                  'label': 'Version'
                }
              }
            },
            'c_missed_task': {
              'label': 'Missed Task',
              'properties': {
                'c_due_after': {
                  'label': 'Due After'
                },
                'c_due_before': {
                  'label': 'Due Before'
                },
                'c_group_task': {
                  'label': 'Group Task'
                },
                'c_public_user': {
                  'label': 'Participant'
                },
                'c_site': {
                  'label': 'Site'
                }
              }
            },
            'c_public_user': {
              'label': 'Participant',
              'properties': {
                'c_access_code': {
                  'label': 'Access Code'
                },
                'c_account': {
                  'label': 'Account'
                },
                'c_baseline_date': {
                  'label': 'Baseline Date'
                },
                'c_caregivers': {
                  'label': 'Caregivers'
                },
                'c_connection_id': {
                  'label': 'Connection ID'
                },
                'c_email': {
                  'label': 'Email'
                },
                'c_enrollment_date': {
                  'label': 'Enrollment Date'
                },
                'c_group': {
                  'label': 'Task Group'
                },
                'c_invite': {
                  'label': 'Invite Status'
                },
                'c_last_invite_time': {
                  'label': 'Last Invite Time'
                },
                'c_locale': {
                  'label': 'Locale'
                },
                'c_mobile': {
                  'label': 'Mobile'
                },
                'c_number': {
                  'label': 'Participant ID'
                },
                'c_open_queries': {
                  'label': 'Open Queries'
                },
                'c_participant_name_or_email': {
                  'label': 'Participant Name or Email'
                },
                'c_pin_expiry_time': {
                  'label': 'Pin Expiry Time'
                },
                'c_review_status': {
                  'label': 'Casebook Status'
                },
                'c_search': {
                  'label': 'Search'
                },
                'c_set_dates': {
                  'label': 'Set Dates',
                  'properties': {
                    'c_date': {
                      'label': 'Date'
                    },
                    'c_template': {
                      'label': 'Template'
                    }
                  }
                },
                'c_signatures': {
                  'label': 'Signatures'
                },
                'c_site': {
                  'label': 'Site'
                },
                'c_start': {
                  'label': 'Start'
                },
                'c_state': {
                  'label': 'State'
                },
                'c_status': {
                  'label': 'Status'
                },
                'c_study': {
                  'label': 'Study'
                },
                'c_task_responses': {
                  'label': 'Task Responses'
                },
                'c_type': {
                  'label': 'Type'
                },
                'c_tz': {
                  'label': 'Time Zone'
                },
                'c_username': {
                  'label': 'Username'
                },
                'c_visit_events': {
                  'label': 'Visit Events'
                },
                'c_visit_schedule': {
                  'label': 'Visit Schedule'
                }
              }
            },
            'c_query': {
              'label': 'Query',
              'properties': {
                'c_closed_by': {
                  'label': 'Closed By'
                },
                'c_closed_datetime': {
                  'label': 'Closed Datetime'
                },
                'c_closing_reason': {
                  'label': 'Closing Reason'
                },
                'c_description': {
                  'label': 'Message'
                },
                'c_manually_closed': {
                  'label': 'Manually Closed'
                },
                'c_notes': {
                  'label': 'Notes'
                },
                'c_number': {
                  'label': 'Number'
                },
                'c_query_rule': {
                  'label': 'Query Rule'
                },
                'c_responded_by': {
                  'label': 'Responded By'
                },
                'c_responded_datetime': {
                  'label': 'Responded Datetime'
                },
                'c_response': {
                  'label': 'Response'
                },
                'c_search': {
                  'label': 'Search'
                },
                'c_site': {
                  'label': 'Site'
                },
                'c_status': {
                  'label': 'Status'
                },
                'c_step_response': {
                  'label': 'Step Response'
                },
                'c_study': {
                  'label': 'Study'
                },
                'c_subject': {
                  'label': 'Participant'
                },
                'c_task_response': {
                  'label': 'Task Response'
                },
                'c_type': {
                  'label': 'Type'
                }
              }
            },
            'c_query_note': {
              'label': 'Query Note',
              'properties': {
                'c_note': {
                  'label': 'Note'
                },
                'c_query': {
                  'label': 'Query'
                }
              }
            },
            'c_query_rule': {
              'label': 'Query Rule',
              'properties': {
                'c_key': {
                  'label': 'Key'
                },
                'c_message': {
                  'label': 'Message'
                },
                'c_name': {
                  'label': 'Name'
                },
                'c_relevant_steps': {
                  'label': 'c_relevant_steps'
                },
                'c_rules': {
                  'label': 'Rules'
                },
                'c_target_field': {
                  'label': 'Target Field'
                },
                'c_task': {
                  'label': 'Task'
                },
                'c_variables': {
                  'label': 'Variables'
                }
              }
            },
            'c_research_datum': {
              'label': 'Research Data',
              'properties': {
                'c_datetime': {
                  'label': 'Date/Time'
                },
                'c_study': {
                  'label': 'Study'
                },
                'c_type': {
                  'label': 'Type'
                },
                'c_value': {
                  'label': 'Value'
                }
              }
            },
            'c_site': {
              'label': 'Site',
              'properties': {
                'c_addresses': {
                  'label': 'Addresses',
                  'properties': {
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_line': {
                      'label': 'Line'
                    },
                    'c_type': {
                      'label': 'Type'
                    }
                  }
                },
                'c_contacts': {
                  'label': 'Contacts',
                  'properties': {
                    'c_contact': {
                      'label': 'Contact'
                    },
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_type': {
                      'label': 'Type'
                    }
                  }
                },
                'c_country': {
                  'label': 'Country'
                },
                'c_key': {
                  'label': 'Key'
                },
                'c_locks': {
                  'label': 'Locks'
                },
                'c_missed_tasks': {
                  'label': 'Missed Tasks'
                },
                'c_name': {
                  'label': 'Name'
                },
                'c_number': {
                  'label': 'Number'
                },
                'c_pi_name': {
                  'label': 'Principal Investigator Name'
                },
                'c_queries': {
                  'label': 'Queries'
                },
                'c_site_users': {
                  'label': 'Site Users'
                },
                'c_study': {
                  'label': 'Study'
                },
                'c_subjects': {
                  'label': 'Participants'
                },
                'c_supported_locales': {
                  'label': 'Supported Locales'
                },
                'c_task_responses': {
                  'label': 'Task Responses'
                }
              }
            },
            'c_site_user': {
              'label': 'Site User',
              'properties': {
                'c_account': {
                  'label': 'Account'
                },
                'c_role': {
                  'label': 'Role'
                },
                'c_site': {
                  'label': 'Site'
                }
              }
            },
            'c_step': {
              'label': 'Step',
              'properties': {
                'c_accessibility_hint': {
                  'label': 'Accessibility Hint'
                },
                'c_accessibility_instructions': {
                  'label': 'Accessibility Instructions'
                },
                'c_account_map': {
                  'label': 'Account Map'
                },
                'c_allow_multiples': {
                  'label': 'Allow Multiples'
                },
                'c_assets': {
                  'label': 'Assets',
                  'properties': {
                    'c_file': {
                      'label': 'File'
                    },
                    'c_identifier': {
                      'label': 'Identifier'
                    },
                    'c_key': {
                      'label': 'Key'
                    }
                  }
                },
                'c_calendar': {
                  'label': 'Calendar'
                },
                'c_camera': {
                  'label': 'Camera'
                },
                'c_cdash_domain': {
                  'label': 'CDASH Domain'
                },
                'c_completion_text_list': {
                  'label': 'Completion Text List'
                },
                'c_completion_text_list_restrict': {
                  'label': 'Completion Text List Restriction'
                },
                'c_content_url': {
                  'label': 'Content URL'
                },
                'c_date_only': {
                  'label': 'Date Only'
                },
                'c_default': {
                  'label': 'Default'
                },
                'c_default_date': {
                  'label': 'Default Date'
                },
                'c_default_hour': {
                  'label': 'Default Hour'
                },
                'c_default_index': {
                  'label': 'Default Index'
                },
                'c_default_interval': {
                  'label': 'Default Interval'
                },
                'c_default_minute': {
                  'label': 'Default Minute'
                },
                'c_default_value': {
                  'label': 'Default Value'
                },
                'c_description': {
                  'label': 'Description'
                },
                'c_disabled': {
                  'label': 'Disabled'
                },
                'c_document_section': {
                  'label': 'Document Section'
                },
                'c_document_title': {
                  'label': 'Document Title'
                },
                'c_form_steps': {
                  'label': 'Form Steps'
                },
                'c_formal_title': {
                  'label': 'Formal Title'
                },
                'c_fraction_digit': {
                  'label': 'Fraction Digit'
                },
                'c_get_air_quality_data': {
                  'label': 'Get Air Quality Data'
                },
                'c_google_fit_permissions': {
                  'label': 'Google Fit Permissions',
                  'properties': {
                    'c_include_historical': {
                      'label': 'Include Historical'
                    },
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_order': {
                      'label': 'Order'
                    },
                    'c_read_write_type': {
                      'label': 'Read Write Type'
                    },
                    'c_sub_type': {
                      'label': 'Sub Type'
                    },
                    'c_type': {
                      'label': 'Type'
                    },
                    'c_use_decimal': {
                      'label': 'Use Decimal'
                    }
                  }
                },
                'c_hidden': {
                  'label': 'Hidden'
                },
                'c_html_content': {
                  'label': 'HTML Content'
                },
                'c_image': {
                  'label': 'Image File'
                },
                'c_image_choices': {
                  'label': 'Image Choices',
                  'properties': {
                    'c_image': {
                      'label': 'Image File'
                    },
                    'c_image_file': {
                      'label': 'Image File'
                    },
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_name': {
                      'label': 'Name'
                    },
                    'c_order': {
                      'label': 'Order'
                    },
                    'c_text': {
                      'label': 'Text'
                    },
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_image_insets': {
                  'label': 'Image Insets'
                },
                'c_import_id': {
                  'label': 'Import ID'
                },
                'c_instructions': {
                  'label': 'Instructions'
                },
                'c_invalid_message': {
                  'label': 'Invalid Message'
                },
                'c_key': {
                  'label': 'Key'
                },
                'c_learn_more_button': {
                  'label': 'Custom Learn More Button Title'
                },
                'c_mappings': {
                  'label': 'Mappings',
                  'properties': {
                    'c_category': {
                      'label': 'Category'
                    },
                    'c_cdash': {
                      'label': 'CDASH'
                    },
                    'c_domain': {
                      'label': 'Domain'
                    }
                  }
                },
                'c_match_anywhere': {
                  'label': 'Match Anywhere'
                },
                'c_maximum': {
                  'label': 'Maximum'
                },
                'c_maximum_date': {
                  'label': 'Maximum Date'
                },
                'c_maximum_description': {
                  'label': 'Maximum Description'
                },
                'c_maximum_fraction_digit': {
                  'label': 'Maximum Fraction Digit'
                },
                'c_maximum_length': {
                  'label': 'Maximum Length'
                },
                'c_minimum': {
                  'label': 'Minimum'
                },
                'c_minimum_date': {
                  'label': 'Minimum Date'
                },
                'c_minimum_description': {
                  'label': 'Minimum Description'
                },
                'c_multiple_lines': {
                  'label': 'Multiple Lines'
                },
                'c_name': {
                  'label': 'Name'
                },
                'c_no_completion_image': {
                  'label': 'No Completion Image'
                },
                'c_omit_from_doc': {
                  'label': 'Omit from Document'
                },
                'c_optional': {
                  'label': 'Optional'
                },
                'c_order': {
                  'label': 'Order'
                },
                'c_original_item': {
                  'label': 'Original Item'
                },
                'c_original_step': {
                  'label': 'Original Step'
                },
                'c_parent': {
                  'label': 'Parent'
                },
                'c_parent_step': {
                  'label': 'Parent Step'
                },
                'c_placeholder': {
                  'label': 'Placeholder'
                },
                'c_quantity_types': {
                  'label': 'Quantity Types',
                  'properties': {
                    'c_include_historical': {
                      'label': 'Include Historical'
                    },
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_order': {
                      'label': 'Order'
                    },
                    'c_read_write_type': {
                      'label': 'Read/Write Type'
                    },
                    'c_sub_type': {
                      'label': 'Sub Type'
                    },
                    'c_type': {
                      'label': 'Type'
                    },
                    'c_unit': {
                      'label': 'Unit'
                    },
                    'c_use_decimal': {
                      'label': 'Use Decimal'
                    }
                  }
                },
                'c_question': {
                  'label': 'Question'
                },
                'c_require_validation': {
                  'label': 'Require Validation'
                },
                'c_result_type': {
                  'label': 'Result Type'
                },
                'c_secure_text_entry': {
                  'label': 'Secure Text Entry'
                },
                'c_step_size': {
                  'label': 'Step Size'
                },
                'c_style': {
                  'label': 'Style'
                },
                'c_success': {
                  'label': 'Success'
                },
                'c_task': {
                  'label': 'Task'
                },
                'c_text': {
                  'label': 'Text'
                },
                'c_text_choices': {
                  'label': 'Text Choices',
                  'properties': {
                    'c_description': {
                      'label': 'Description'
                    },
                    'c_exclusive': {
                      'label': 'Exclusive'
                    },
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_order': {
                      'label': 'Order'
                    },
                    'c_text': {
                      'label': 'Display Text'
                    },
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_type': {
                  'label': 'Type'
                },
                'c_unit': {
                  'label': 'Unit'
                },
                'c_use_current_location': {
                  'label': 'Use Current Location'
                },
                'c_validation_regex': {
                  'label': 'Validation Regex'
                },
                'c_validation_type': {
                  'label': 'Validation Type'
                },
                'c_vertical': {
                  'label': 'Vertical'
                },
                'c_visible': {
                  'label': 'Visible'
                }
              }
            },
            'c_step_response': {
              'label': 'Step Response',
              'objectTypes': {
                'c_active_task': {
                  'label': 'Active Task',
                  'properties': {
                    'c_value': {
                      'label': 'Value',
                      'properties': {
                        'c_file': {
                          'label': 'File'
                        },
                        'c_filename': {
                          'label': 'Filename'
                        },
                        'c_identifier': {
                          'label': 'Ientifier'
                        }
                      }
                    }
                  }
                },
                'c_barcode_scanner': {
                  'label': 'Barcode Scanner',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_boolean': {
                  'label': 'Boolean',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_completion': {
                  'label': 'Completion',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_consent': {
                  'label': 'Consent',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_consent_review': {
                  'label': 'Consent Review',
                  'properties': {
                    'c_file': {
                      'label': 'File'
                    },
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_continuous_scale': {
                  'label': 'Continuous Scale',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_date': {
                  'label': 'Date',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_datetime': {
                  'label': 'Datetime',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_email': {
                  'label': 'Email',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_image_capture': {
                  'label': 'Image Capture',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_image_choice': {
                  'label': 'Image Choice',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_instruction': {
                  'label': 'Instruction',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_integer_scale': {
                  'label': 'Integer Scale',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_location': {
                  'label': 'Location',
                  'properties': {
                    'c_data': {
                      'label': 'Data'
                    },
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_nucleus_question_review': {
                  'label': 'Question Review',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_numeric': {
                  'label': 'Numeric',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_text': {
                  'label': 'Text',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_text_choice': {
                  'label': 'Text Choice',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_text_scale': {
                  'label': 'Text Scale',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_time_interval': {
                  'label': 'Time Interval',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_time_of_day': {
                  'label': 'Time of Day',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                },
                'c_value_picker': {
                  'label': 'Value Picker',
                  'properties': {
                    'c_value': {
                      'label': 'Value'
                    }
                  }
                }
              },
              'properties': {
                'c_account': {
                  'label': 'Account'
                },
                'c_cdash_variable': {
                  'label': 'CDASH Variable'
                },
                'c_completion_instructions': {
                  'label': 'Completion Instructions'
                },
                'c_end_date': {
                  'label': 'End Date'
                },
                'c_group': {
                  'label': 'Task Group'
                },
                'c_public_user': {
                  'label': 'Participant'
                },
                'c_queries': {
                  'label': 'Queries'
                },
                'c_site': {
                  'label': 'Site'
                },
                'c_skipped': {
                  'label': 'Skipped'
                },
                'c_start_date': {
                  'label': 'Start Date'
                },
                'c_step': {
                  'label': 'Step'
                },
                'c_study': {
                  'label': 'Study'
                },
                'c_task': {
                  'label': 'Task'
                },
                'c_task_response': {
                  'label': 'Task Response'
                },
                'c_visit': {
                  'label': 'Visit'
                }
              }
            },
            'c_study': {
              'label': 'Study',
              'properties': {
                'c_all_tasks': {
                  'label': 'All Tasks'
                },
                'c_anchor_date_templates': {
                  'label': 'Anchor Date Templates'
                },
                'c_auth_task_fields': {
                  'label': 'Auth Task Fields'
                },
                'c_code': {
                  'label': 'Code Name'
                },
                'c_configuration': {
                  'label': 'Configuration',
                  'properties': {
                    'c_action_failed_color': {
                      'label': 'Action Failed Color'
                    },
                    'c_callout_color': {
                      'label': 'Callout Color'
                    },
                    'c_consent': {
                      'label': 'Gradient Principal'
                    },
                    'c_gradient_principal': {
                      'label': 'Gradient Principal'
                    },
                    'c_gradient_secondary': {
                      'label': 'Gradient Secondary'
                    },
                    'c_organization_logo': {
                      'label': 'Organization Logo'
                    },
                    'c_principal_color': {
                      'label': 'Principal Color'
                    },
                    'c_principal_text_color': {
                      'label': 'Principal Text Color'
                    },
                    'c_receive_notifications': {
                      'label': 'Receive Notifications'
                    },
                    'c_secondary_color': {
                      'label': 'Secondary Color'
                    },
                    'c_secondary_text_color': {
                      'label': 'Secondary Text Color'
                    },
                    'c_study_logo': {
                      'label': 'Study Logo'
                    }
                  }
                },
                'c_default_subject_group': {
                  'label': 'Default Participant Group'
                },
                'c_default_subject_site': {
                  'label': 'Default Participant Site'
                },
                'c_default_subject_visit_schedule': {
                  'label': 'Default Participant Visit Schedule'
                },
                'c_description': {
                  'label': 'Description'
                },
                'c_enable_alt_reg': {
                  'label': 'Enable Alternate Registration'
                },
                'c_end_date': {
                  'label': 'End Date'
                },
                'c_exports': {
                  'label': 'Exports'
                },
                'c_field': {
                  'label': 'Field of Study'
                },
                'c_forgot_username_options': {
                  'label': 'Forgot Username Options'
                },
                'c_format_spec_queries': {
                  'label': 'Format Spec Queries'
                },
                'c_format_spec_sites': {
                  'label': 'Format Spec Sites'
                },
                'c_format_spec_subject_id': {
                  'label': 'Format Spec Participant ID'
                },
                'c_format_spec_tasks': {
                  'label': 'Format Spec Tasks'
                },
                'c_goal': {
                  'label': 'Participant Goal'
                },
                'c_groups': {
                  'label': 'Groups'
                },
                'c_information': {
                  'label': 'Information',
                  'properties': {
                    'c_assets': {
                      'label': 'Assets'
                    },
                    'c_content': {
                      'label': 'Content'
                    },
                    'c_content_is_html': {
                      'label': 'Content is HTML'
                    },
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_title': {
                      'label': 'Title'
                    },
                    'c_web_link': {
                      'label': 'Web Link'
                    }
                  }
                },
                'c_invite_code_ttl': {
                  'label': 'Invite Code TTL'
                },
                'c_key': {
                  'label': 'Key'
                },
                'c_localized_faults': {
                  'label': 'Localized Faults'
                },
                'c_menu_config': {
                  'label': 'Menu Config',
                  'properties': {
                    'c_display_name': {
                      'label': 'Display Name'
                    },
                    'c_group_id': {
                      'label': 'Group Id'
                    },
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_menu': {
                      'label': 'Menu'
                    }
                  }
                },
                'c_name': {
                  'label': 'Name'
                },
                'c_patient_app_display_options': {
                  'label': 'Patient App Display Options',
                  'properties': {
                    'c_profile_fields': {
                      'label': 'Profile Fields'
                    },
                    'c_show_consent_documents': {
                      'label': 'Show Consent Documents'
                    },
                    'c_show_language_selector': {
                      'label': 'Show Language Selector'
                    },
                    'c_show_leave_study': {
                      'label': 'Show Leave Study'
                    },
                    'c_show_site_information': {
                      'label': 'Show Site Information'
                    },
                    'c_show_subject_number': {
                      'label': 'Show Subject Number'
                    }
                  }
                },
                'c_privacy_items': {
                  'label': 'Privacy Items',
                  'properties': {
                    'c_apps': {
                      'label': 'Apps'
                    },
                    'c_html_content': {
                      'label': 'HTML Content'
                    },
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_label': {
                      'label': 'Name'
                    },
                    'c_url': {
                      'label': 'URL'
                    }
                  }
                },
                'c_protocol_number': {
                  'label': 'Protocol Number'
                },
                'c_public_group': {
                  'label': 'Public Group'
                },
                'c_queries': {
                  'label': 'Queries'
                },
                'c_reasons_for_change': {
                  'label': 'Reasons For Change'
                },
                'c_requires_invite': {
                  'label': 'Requires Invite'
                },
                'c_resources': {
                  'label': 'Resources',
                  'properties': {
                    'c_assets': {
                      'label': 'Assets'
                    },
                    'c_content': {
                      'label': 'Content'
                    },
                    'c_content_is_html': {
                      'label': 'Content is HTML'
                    },
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_title': {
                      'label': 'Title'
                    },
                    'c_web_link': {
                      'label': 'Web Link'
                    }
                  }
                },
                'c_review_types': {
                  'label': 'Review Types',
                  'properties': {
                    'c_active': {
                      'label': 'Active'
                    },
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_name': {
                      'label': 'Name'
                    },
                    'c_roles': {
                      'label': 'Roles'
                    }
                  }
                },
                'c_sites': {
                  'label': 'Sites'
                },
                'c_sponsor_name': {
                  'label': 'Study Contact Information'
                },
                'c_start_date': {
                  'label': 'Start Date'
                },
                'c_step_responses': {
                  'label': 'Step Responses'
                },
                'c_store_invite_data': {
                  'label': 'Store Invite Data'
                },
                'c_study_team_users': {
                  'label': 'Study Team Users'
                },
                'c_subject_enrollment_status': {
                  'label': 'Participant Enrollment status'
                },
                'c_subject_invite_validation': {
                  'label': 'Participant Invite Validation'
                },
                'c_subject_menu_config': {
                  'label': 'Participant Menu Config',
                  'properties': {
                    'c_button_title': {
                      'label': 'Button Title'
                    },
                    'c_column_props': {
                      'label': 'Column Props'
                    },
                    'c_columns': {
                      'label': 'Columns'
                    },
                    'c_key': {
                      'label': 'Key'
                    },
                    'c_long_name': {
                      'label': 'Long Name'
                    },
                    'c_short_name': {
                      'label': 'Short Name'
                    },
                    'c_task_id': {
                      'label': 'Task Id'
                    }
                  }
                },
                'c_subject_status_list': {
                  'label': 'Participant Status List',
                  'properties': {
                    'c_status_value': {
                      'label': 'Status Value'
                    }
                  }
                },
                'c_supported_locales': {
                  'label': 'Supported Locales'
                },
                'c_task_responses': {
                  'label': 'Task Responses'
                },
                'c_tasks': {
                  'label': 'Tasks'
                },
                'c_televisit_enabled': {
                  'label': 'Televisit Enabled'
                },
                'c_visit_schedules': {
                  'label': 'Visit Schedules'
                }
              }
            },
            'c_study_export': {
              'label': 'Study Export',
              'properties': {
                'c_export': {
                  'label': 'Export'
                },
                'c_study': {
                  'label': 'Study'
                },
                'c_type': {
                  'label': 'Type'
                }
              }
            },
            'c_study_team_user': {
              'label': 'Study Team User',
              'properties': {
                'c_account': {
                  'label': 'Account'
                },
                'c_role': {
                  'label': 'Role'
                },
                'c_study': {
                  'label': 'Study'
                }
              }
            },
            'c_task': {
              'label': 'Task',
              'properties': {
                'c_accelerometer': {
                  'label': 'Accelerometer'
                },
                'c_active_type': {
                  'label': 'Active Type'
                },
                'c_audio': {
                  'label': 'Audio'
                },
                'c_branches': {
                  'label': 'Branches'
                },
                'c_category': {
                  'label': 'Category'
                },
                'c_cloning_flag': {
                  'label': 'Cloning Flag'
                },
                'c_code': {
                  'label': 'Code Name'
                },
                'c_conclusion': {
                  'label': 'Conclusion'
                },
                'c_consent_appendix': {
                  'label': 'Consent Appendix'
                },
                'c_consent_cover_html': {
                  'label': 'Consent Cover Html'
                },
                'c_consent_hcp_statement': {
                  'label': 'Consent HCP Statement'
                },
                'c_consent_type': {
                  'label': 'Consent Type'
                },
                'c_description': {
                  'label': 'Description'
                },
                'c_device_motion': {
                  'label': 'Device Motion'
                },
                'c_dominant_left': {
                  'label': 'Dominant Left'
                },
                'c_duration': {
                  'label': 'Duration'
                },
                'c_eligibility_condition': {
                  'label': 'Eligibility Condition'
                },
                'c_groups': {
                  'label': 'Participant Groups'
                },
                'c_heart_rate': {
                  'label': 'Heart Rate'
                },
                'c_html_review_content': {
                  'label': 'HTML Review Content'
                },
                'c_import_id': {
                  'label': 'Import ID'
                },
                'c_include_in_report': {
                  'label': 'Include in missing data report'
                },
                'c_instructions': {
                  'label': 'Instructions'
                },
                'c_intended_use': {
                  'label': 'Intended Use'
                },
                'c_key': {
                  'label': 'Key'
                },
                'c_location': {
                  'label': 'Location'
                },
                'c_name': {
                  'label': 'Name'
                },
                'c_number_of_disks': {
                  'label': 'Number Of Disks'
                },
                'c_number_of_pegs': {
                  'label': 'Number Of Pegs'
                },
                'c_number_of_steps_per_leg': {
                  'label': 'Number Of Steps Per Leg'
                },
                'c_pedometer': {
                  'label': 'Pedometer'
                },
                'c_record_settings': {
                  'label': 'Record Settings'
                },
                'c_requires_subject': {
                  'label': 'Requires Participant'
                },
                'c_response_validity_period_unit': {
                  'label': 'Response Validity Period Unit'
                },
                'c_response_validity_period_value': {
                  'label': 'Response Validity Period Value'
                },
                'c_rest_duration': {
                  'label': 'Rest Duration'
                },
                'c_rotated': {
                  'label': 'Rotated'
                },
                'c_sdm_review_required': {
                  'label': 'Source Data Manager Review Required'
                },
                'c_self_assessment': {
                  'label': 'Self Assessment'
                },
                'c_set_subject_status_failure': {
                  'label': 'Set Participant Status Failure'
                },
                'c_set_subject_status_success': {
                  'label': 'Set Participant Status Success'
                },
                'c_short_speech_instruction': {
                  'label': 'Short Speech Instruction'
                },
                'c_speech_instruction': {
                  'label': 'Speech Instruction'
                },
                'c_steps': {
                  'label': 'Steps'
                },
                'c_study': {
                  'label': 'Study'
                },
                'c_survey_schedule_unit': {
                  'label': 'Survey Schedule Unit'
                },
                'c_survey_schedule_value': {
                  'label': 'Survey Schedule Value'
                },
                'c_threshold': {
                  'label': 'Threshold'
                },
                'c_time_limit': {
                  'label': 'Time Limit'
                },
                'c_type': {
                  'label': 'Type'
                },
                'c_use_as_template': {
                  'label': 'Use as Template'
                },
                'c_validated_instrument': {
                  'label': 'Validated Instrument',
                  'properties': {
                    'c_vi_html_footer': {
                      'label': 'VI HTML Footer'
                    },
                    'c_vi_html_header': {
                      'label': 'VI HTML Header'
                    }
                  }
                },
                'c_visits': {
                  'label': 'Visits'
                },
                'c_walk_duration': {
                  'label': 'Walk Duration'
                }
              }
            },
            'c_task_response': {
              'label': 'Task Response',
              'properties': {
                'c_account': {
                  'label': 'Account'
                },
                'c_clean_status': {
                  'label': 'Clean Status'
                },
                'c_completed': {
                  'label': 'Completed'
                },
                'c_data_manager_review': {
                  'label': 'Data Manager Review'
                },
                'c_end': {
                  'label': 'End'
                },
                'c_group': {
                  'label': 'Group'
                },
                'c_inactive': {
                  'label': 'Inactive'
                },
                'c_locale': {
                  'label': 'Number'
                },
                'c_number': {
                  'label': 'Number'
                },
                'c_public_user': {
                  'label': 'Participant'
                },
                'c_queries': {
                  'label': 'Queries'
                },
                'c_reviews': {
                  'label': 'Reviews'
                },
                'c_site': {
                  'label': 'Site'
                },
                'c_start': {
                  'label': 'Start'
                },
                'c_status': {
                  'label': 'Status'
                },
                'c_step_responses': {
                  'label': 'Step Responses'
                },
                'c_study': {
                  'label': 'Study'
                },
                'c_success': {
                  'label': 'Success'
                },
                'c_task': {
                  'label': 'Task'
                },
                'c_tz': {
                  'label': 'Time Zone'
                },
                'c_uuid': {
                  'label': 'UUID'
                },
                'c_visit': {
                  'label': 'Visit'
                }
              }
            },
            'c_visit': {
              'label': 'Visit',
              'properties': {
                'c_anchor_date': {
                  'label': 'Anchor Date'
                },
                'c_groups': {
                  'label': 'Groups'
                },
                'c_key': {
                  'label': 'Key'
                },
                'c_name': {
                  'label': 'Name'
                },
                'c_schedule': {
                  'label': 'Schedule',
                  'properties': {
                    'c_days_from_start': {
                      'label': 'Days From Start'
                    },
                    'c_minus': {
                      'label': 'Minus'
                    },
                    'c_plus': {
                      'label': 'Plus'
                    }
                  }
                },
                'c_visit_schedules': {
                  'label': 'Visit Schedules'
                }
              }
            },
            'c_visit_schedule': {
              'label': 'Visit Schedule',
              'properties': {
                'c_default_anchor_date': {
                  'label': 'Default Anchor Date'
                },
                'c_key': {
                  'label': 'Key'
                },
                'c_name': {
                  'label': 'Name'
                },
                'c_study': {
                  'label': 'Study'
                },
                'c_visits': {
                  'label': 'Visits'
                }
              }
            },
            'org': {
              'label': 'Organization',
              'properties': {
                'c_pin': {
                  'label': 'Pin'
                }
              }
            },
            'c_review': {
              'label': 'Review',
              'properties': {
                'c_date': {
                  'label': 'Date'
                },
                'c_invalidated_at': {
                  'label': 'Invalidated At'
                },
                'c_review_type': {
                  'label': 'Review Type'
                },
                'c_reviewer': {
                  'label': 'Reviewer'
                },
                'c_task_response': {
                  'label': 'Task Response'
                }
              }
            },
            'c_lock': {
              'label': 'Lock',
              'properties': {
                'c_active': {
                  'label': 'Active'
                },
                'c_item': {
                  'label': 'Item'
                },
                'c_locked_object_id': {
                  'label': 'Locked Object Id'
                },
                'c_locked_object_type': {
                  'label': 'Locked Object Type'
                },
                'c_site': {
                  'label': 'Site'
                },
                'c_snapshot_date': {
                  'label': 'Snapshot Date'
                },
                'c_type': {
                  'label': 'Type'
                }
              }
            },
            'c_anchor_date_template': {
              'label': 'Anchor Date Template',
              'properties': {
                'c_date_time_step': {
                  'label': 'Date Time Step'
                },
                'c_identifier': {
                  'label': 'Anchor Date Name'
                },
                'c_key': {
                  'label': 'Key'
                },
                'c_static_date': {
                  'label': 'Static Date'
                },
                'c_study': {
                  'label': 'Study'
                },
                'c_task_completion': {
                  'label': 'Task Completion'
                },
                'c_type': {
                  'label': 'Type'
                }
              }
            }
          }
        },
        'locale': 'en_US',
        'name': 'axon__en_US_objects_v2',
        'namespace': 'axon'
      }
      return org.objects.i18n.insertOne(data).grant(6).execute()

    }))

    const result = await promised(null, sandboxed(function() {
      /* global org */
      const { environment } = require('developer'),
            manifest = { 'object': 'manifest', 'i18ns': { 'includes': ['*'] } }
      return environment.export({ manifest }, { backup: false, triggers: false }).toArray()
    }))

    should.exist(result)
    should(result[0].object).equal('i18n')
    should(result[0].locale).equal('en_US')

  })
})

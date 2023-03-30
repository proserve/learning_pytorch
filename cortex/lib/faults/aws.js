'use strict'

const Fault = require('cortex-service/lib/fault'),
      { camelize } = require('inflection')

;[
  [ 'AccessDenied', '403 Forbidden', 403 ],
  [ 'AccountProblem', 'There is a problem with your AWS account that prevents the operation from completing successfully. Please use Contact Us.', 403 ],
  [ 'AmbiguousGrantByEmailAddress', 'The e-mail address you provided is associated with more than one account.', 400 ],
  [ 'BadDigest', 'The Content-MD5 you specified did not match what we received.', 400 ],
  [ 'BucketAlreadyExists', 'The requested bucket name is not available. The bucket namespace is shared by all users of the system. Please select a different name and try again.', 409 ],
  [ 'BucketAlreadyOwnedByYou', 'Your previous request to create the named bucket succeeded and you already own it. You get this error in all AWS regions except US Standard, us-east-1. In us-east-1 region, you will get 200 OK, but it is no-op (if bucket exists it Amazon S3 will not do anything).', 409 ],
  [ 'BucketNotEmpty', 'The bucket you tried to delete is not empty.', 409 ],
  [ 'CredentialsNotSupported', 'This request does not support credentials.', 400 ],
  [ 'CrossLocationLoggingProhibited', 'Cross location logging not allowed. Buckets in one geographic location cannot log information to a bucket in another location.', 403 ],
  [ 'EntityTooSmall', 'Your proposed upload is smaller than the minimum allowed object size.', 400 ],
  [ 'EntityTooLarge', 'Your proposed upload exceeds the maximum allowed object size.', 400 ],
  [ 'ExpiredToken', 'The provided token has expired.', 400 ],
  [ 'IllegalVersioningConfigurationException', 'Indicates that the Versioning configuration specified in the request is invalid.', 400 ],
  [ 'IncompleteBody', 'You did not provide the number of bytes specified by the Content-Length HTTP header', 400 ],
  [ 'IncorrectNumberOfFilesInPostRequest', 'POST requires exactly one file upload per request.', 400 ],
  [ 'InlineDataTooLarge', 'Inline data exceeds the maximum allowed size.', 400 ],
  [ 'InternalError', 'We encountered an internal error. Please try again.', 500 ],
  [ 'InvalidAccessKeyId', 'The AWS Access Key Id you provided does not exist in our records.', 403 ],
  [ 'InvalidAddressingHeader', 'You must specify the Anonymous role.', 400 ],
  [ 'InvalidArgument', 'Invalid Argument', 400 ],
  [ 'InvalidBucketName', 'The specified bucket is not valid.', 400 ],
  [ 'InvalidBucketState', 'The request is not valid with the current state of the bucket.', 409 ],
  [ 'InvalidDigest', 'The Content-MD5 you specified was an invalid.', 400 ],
  [ 'InvalidLocationConstraint', 'The specified location constraint is not valid. For more information about Regions, see How to Select a Region for Your Buckets.', 400 ],
  [ 'InvalidObjectState', 'The operation is not valid for the current state of the object.', 403 ],
  [ 'InvalidPart', "One or more of the specified parts could not be found. The part might not have been uploaded, or the specified entity tag might not have matched the part's entity tag.", 400 ],
  [ 'InvalidPartOrder', 'The list of parts was not in ascending order.Parts list must specified in order by part number.', 400 ],
  [ 'InvalidPayer', 'All access to this object has been disabled.', 403 ],
  [ 'InvalidPolicyDocument', 'The content of the form does not meet the conditions specified in the policy document.', 400 ],
  [ 'InvalidRange', 'The requested range cannot be satisfied.', 416 ],
  [ 'InvalidRequest', 'SOAP requests must be made over an HTTPS connection.', 400 ],
  [ 'InvalidSecurity', 'The provided security credentials are not valid.', 403 ],
  [ 'InvalidSOAPRequest', 'The SOAP request body is invalid.', 400 ],
  [ 'InvalidStorageClass', 'The storage class you specified is not valid.', 400 ],
  [ 'InvalidTargetBucketForLogging', 'The target bucket for logging does not exist, is not owned by you, or does not have the appropriate grants for the log-delivery group.', 400 ],
  [ 'InvalidToken', 'The provided token is malformed or otherwise invalid.', 400 ],
  [ 'InvalidURI', "Couldn't parse the specified URI.", 400 ],
  [ 'KeyTooLong', 'Your key is too long.', 400 ],
  [ 'MalformedACLError', 'The XML you provided was not well-formed or did not validate against our published schema.', 400 ],
  [ 'MalformedPOSTRequest', 'The body of your POST request is not well-formed multipart/form-data.', 400 ],
  [ 'MalformedXML', 'The XML you provided was not well-formed or did not validate against our published schema', 400 ],
  [ 'MaxMessageLengthExceeded', 'Your request was too big.', 400 ],
  [ 'MaxPostPreDataLengthExceededError', 'Your POST request fields preceding the upload file were too large.', 400 ],
  [ 'MetadataTooLarge', 'Your metadata headers exceed the maximum allowed metadata size.', 400 ],
  [ 'MethodNotAllowed', 'The specified method is not allowed against this resource.', 405 ],
  [ 'MissingAttachment', 'A SOAP attachment was expected, but none were found.', 400 ],
  [ 'MissingContentLength', 'You must provide the Content-Length HTTP header.', 411 ],
  [ 'MissingRequestBodyError', 'Request body is empty.', 400 ],
  [ 'MissingSecurityElement', 'The SOAP 1.1 request is missing a security element.', 400 ],
  [ 'MissingSecurityHeader', 'Your request was missing a required header.', 400 ],
  [ 'NoLoggingStatusForKey', 'There is no such thing as a logging status sub-resource for a key.', 400 ],
  [ 'NoSuchBucket', 'The specified bucket does not exist.', 404 ],
  [ 'NoSuchKey', 'The specified key does not exist.', 404 ],
  [ 'NotFound', 'Resource nort found.', 404 ],
  [ 'NoSuchLifecycleConfiguration', 'The lifecycle configuration does not exist.', 404 ],
  [ 'NoSuchUpload', 'The specified multipart upload does not exist. The upload ID might be invalid, or the multipart upload might have been aborted or completed.', 404 ],
  [ 'NoSuchVersion', 'Indicates that the version ID specified in the request does not match an existing version.', 404 ],
  [ 'NotImplemented', 'A header you provided implies functionality that is not implemented.', 501 ],
  [ 'NotSignedUp', 'Your account is not signed up for the Amazon S3 service. You must sign up before you can use Amazon S3. You can sign up at the following URL: http://aws.amazon.com/s3', 403 ],
  [ 'NotSuchBucketPolicy', 'The specified bucket does not have a bucket policy.', 404 ],
  [ 'OperationAborted', 'A conflicting conditional operation is currently in progress against this resource. Please try again.', 409 ],
  [ 'PermanentRedirect', 'The bucket you are attempting to access must be addressed using the specified endpoint. Please send all future requests to this endpoint.', 301 ],
  [ 'PreconditionFailed', 'At least one of the preconditions you specified did not hold.', 412 ],
  [ 'Redirect', 'Temporary redirect.', 307 ],
  [ 'RestoreAlreadyInProgress', 'Object restore is already in progress.', 409 ],
  [ 'RequestIsNotMultiPartContent', 'Bucket POST must be of the enclosure-type multipart/form-data.', 400 ],
  [ 'RequestTimeout', 'Your socket connection to the server was not read from or written to within the timeout period.', 400 ],
  [ 'RequestTimeTooSkewed', "The difference between the request time and the server's time is too large.", 403 ],
  [ 'RequestTorrentOfBucketError', 'Requesting the torrent file of a bucket is not permitted.', 400 ],
  [ 'SignatureDoesNotMatch', 'The request signature we calculated does not match the signature you provided. Check your AWS Secret Access Key and signing method. For more information, see REST Authentication andSOAP Authentication for details.', 403 ],
  [ 'ServiceUnavailable', 'Please reduce your request rate.', 503 ],
  [ 'SlowDown', 'Please reduce your request rate.', 503 ],
  [ 'TemporaryRedirect', 'You are being redirected to the bucket while DNS updates.', 307 ],
  [ 'TokenRefreshRequired', 'The provided token must be refreshed.', 400 ],
  [ 'TooManyBuckets', 'You have attempted to create more buckets than allowed.', 400 ],
  [ 'UnexpectedContent', 'This request does not support content.', 400 ],
  [ 'UnknownEndpoint', 'Failed to connect to upload server.', 500 ],
  [ 'UnresolvableGrantByEmailAddress', 'The e-mail address you provided does not match any account on record.', 400 ],
  [ 'UserKeyMustBeSpecified', 'The bucket POST must contain the specified field name. If it is specified, please check the order of the fields.', 400 ]].forEach(entry => {
  Fault.addCode('kAwsS3' + entry[0], 'aws', entry[2], entry[1], `aws.s3.${camelize(entry[0], true)}`)
})

Fault.addConverter(err => {
  if (err instanceof Error) {
    if (err.code && err.name && err.retryable != null && err.statusCode != null) {
      const awsErrCode = String(err.code),
            code = 'kAwsS3' + awsErrCode,
            entry = Fault.findRegisteredError(`aws.s3.${camelize(awsErrCode, true)}`)
      if (entry && err.statusCode === entry.statusCode) {
        const fault = Fault.create(code)
        fault.add(err)
        err = fault
      }
    }
  }
  return err
})

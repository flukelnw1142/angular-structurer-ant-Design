import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { NgZorroAntdModule } from '../../../../shared/ng-zorro-antd.module';
import { SharedModule } from '../../../../shared/shared.module';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomerService } from '../../services/customer.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { PostCodeService } from '../../../../shared/constants/post-code.service';
import { AuthService } from '../../../authentication/services/auth.service';
import { IRole } from '../../../user-manager/interface/role.interface';
import { ICustomerType } from '../../interface/customerType.interface';
import { DataLocation } from '../../../supplier/pages/supplier-add/supplier-add.component';
import Swal from 'sweetalert2';
import { EmailService } from '../../../../shared/constants/email.service';
import { debounceTime, distinctUntilChanged } from 'rxjs';


@Component({
  selector: 'app-customer-add',
  standalone: true,
  imports: [SharedModule, NgZorroAntdModule, HttpClientModule],
  providers: [PostCodeService],
  templateUrl: './customer-add.component.html',
  styleUrl: './customer-add.component.scss'
})
export class CustomerAddComponent implements OnInit {
  listOfType: ICustomerType[] = [];
  filteredDataType: ICustomerType[] = [];
  currentUser!: IRole | null;
  items_provinces: DataLocation[] = [];
  filteredItemsProvince: DataLocation[] = [];
  customerForm!: FormGroup;
  customerId: number | null = null;
  isViewMode: boolean = false;
  isAdmin = false;
  isApproved = false;
  isApprovedFN = false;
  isUser = false;
  isSubmitting: boolean = false;
  logs: any[] = [];
  reasonTemp: string = '';
  selectType: string = '';
  private readonly _router = inject(Router);
  private readonly authService = inject(AuthService)
  private _cdr = inject(ChangeDetectorRef);
  emailError: string = '';
  originalData: any;
  listDataByTaxId: any[] = [];
  isDupplicate: boolean = false;
  typeCode: string = '';
  newCusnum: string = '';
  tempCusForm: any;
  files = [
    { fileName: 'ใบขอเปิด Customer', status: null },
    { fileName: 'หนังสือรับรองบริษัท / สำเนาบัตรประชาชน', status: null },
  ];
  file: any;
  listfile: File[] = [];
  uploadedFiles: any[] = [];
  constructor(private _location: Location, private fb: FormBuilder
    , private customerService: CustomerService,
    private router: Router,
    private route: ActivatedRoute,
    private postCodeService: PostCodeService,
    private cdr: ChangeDetectorRef,
    private emailService: EmailService
  ) {

  }

  ngOnInit(): void {
    this.customerForm = this.fb.group({
      id: [0],
      name: ['', Validators.required],
      tax_Id: ['', Validators.required],
      address_sup: ['', Validators.required],
      district: ['', Validators.required],
      subdistrict: ['', Validators.required],
      province: ['', Validators.required],
      postalCode: ['', Validators.required],
      tel: ['', Validators.required],
      email: ['', Validators.required],
      customer_id: ['0', Validators.required],
      customer_num: ['', Validators.required],
      customer_type: ['', Validators.required],
      site: ['', Validators.required],
      status: ['', Validators.required],
      company: ['', Validators.required],
      user_id: [''],
      file_req: [''],
      file_certificate: [''],
      path: ['']
    });
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.customerId = +id;
        this.loadCustomerData(this.customerId);
      }
    });
    if (this.router.url.includes('/view/')) {
      this.isViewMode = true;
      this.customerForm.disable(); // ทำให้ฟอร์มไม่สามารถแก้ไขได้
    }
    this.postCodeService.getPostCodes().subscribe(data => {
      this.items_provinces = data;
      this.filteredItemsProvince = data;
    });
    this.getCustomerType();

    // Subscribe to customer_type changes
    this.customerForm.get('customer_type')!.valueChanges.subscribe(value => {
      const customerTypeId = this.getCustomerTypeId(value);
      if (customerTypeId) {
        this.loadCustomerType(customerTypeId); // เรียกใช้ฟังก์ชันนี้เมื่อมีการเปลี่ยนแปลงค่า customer_type
      }
    });
    // this.customerForm.get('customer_type')!.valueChanges.subscribe(value => {
    //   const customerTypeId = this.getCustomerTypeId(value);
    //   if (customerTypeId) {
    //     this.loadCustomerType(customerTypeId); // เรียกใช้ฟังก์ชันนี้เมื่อมีการเปลี่ยนแปลงค่า customer_type
    //   }
    // });
    this.checkRole();
  }

  validateTaxId(event: any): void {
    const input = event.target.value;

    // ลบตัวอักษรที่ไม่ใช่ตัวเลขหรือตัวอักษร '-'
    let numericValue = input.replace(/[^0-9-]/g, '');

    // จำกัดจำนวนเครื่องหมาย '-' ให้มีเพียงตัวเดียว
    const hyphenCount = (numericValue.match(/-/g) || []).length;

    if (hyphenCount > 1) {
      // ถ้ามี '-' มากกว่า 1 ตัว ให้ลบตัวถัดไปทั้งหมด
      numericValue = numericValue.replace(/-/g, '-').replace('-', '');
    }

    // อัปเดตค่าใน form control
    this.customerForm.patchValue({ tax_Id: numericValue });
    event.target.value = numericValue;
  }

  validateTel(event: any): void {
    const input = event.target.value;

    // ลบตัวอักษรที่ไม่ใช่ตัวเลขหรือตัวอักษร '-'
    let numericValue = input.replace(/[^0-9-]/g, '');

    // จำกัดจำนวนเครื่องหมาย '-' ให้มีเพียงตัวเดียว
    const hyphenCount = (numericValue.match(/-/g) || []).length;

    if (hyphenCount > 1) {
      // ถ้ามี '-' มากกว่า 1 ตัว ให้ลบตัวถัดไปทั้งหมด
      numericValue = numericValue.replace(/-/g, '-').replace('-', '');
    }

    // จำกัดจำนวนตัวเลขไม่เกิน 10 และต้องใส่ '-' ได้เพียงตัวเดียว
    if (numericValue.replace(/-/g, '').length > 10) {
      numericValue = numericValue.slice(0, 10) + (hyphenCount ? '-' : '');
    }

    event.target.value = numericValue;

    // อัปเดตค่าใน form control
    this.customerForm.patchValue({ tel: event.target.value });
  }

  validateSite(event: any): void {
    const input = event.target.value;

    // ลบตัวอักษรที่ไม่ใช่ตัวเลขออก
    const numericValue = input.replace(/\D/g, '');

    // อัปเดตค่าใน form control
    this.customerForm.patchValue({ site: numericValue });
    event.target.value = numericValue;
  }

  checkRole(): void {
    this.authService.currenttRole.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.isAdmin = user.action.includes('admin');
        this.isApproved = user.action.includes('approved');
        this.isApprovedFN = user.action.includes('approvedFN');
        this.isUser = user.action.includes('user');
      }

    });
  }

  loadCustomerData(id: number): void {
    this.customerService.findCustomerById(id).subscribe((data: any) => {
      const postalCodeCombination = data.postalCode + '-' + data.subdistrict;
      this.customerForm.patchValue({
        ...data,
        postalCode: postalCodeCombination
      });
      this.originalData = { ...data };
      this.getEventLogs(id)

    });
  }

  loadCustomerType(id: number): void {
    this.customerService.findCustomerTypeById(id).pipe(debounceTime(300), distinctUntilChanged()).subscribe((data: any) => {
      const customerNumPrefix = data.code_from;
      this.typeCode = customerNumPrefix;
      if (customerNumPrefix === '1F') {
        // Default customer_num เป็น "-" และซ่อนฟิลด์อื่นๆ
        this.customerForm.patchValue({
          customer_num: '-',
          postalCode: '-',
          province: '-',
          district: '-',
          subdistrict: '-',
          site: ''

        });
      }
      // else {
      //   this.customerForm.patchValue({
      //     customer_num: '',
      //     postalCode: '',
      //     province: '',
      //     district: '',
      //     subdistrict: '',
      //     site: ''

      //   });
      // }
      // else {
      //   this.customerService.getTopCustomerByType(data.code).subscribe(topCustomerData => {
      //     let newCustomerNum: string;

      //     if (topCustomerData.customer_num === '000') {
      //       // ถ้าไม่เจอข้อมูล ให้ใช้ค่า default
      //       newCustomerNum = customerNumPrefix + '000001';
      //     } else {
      //       // ถ้าเจอข้อมูล ใช้ค่า customer_num ที่ดึงมาแล้ว increment
      //       newCustomerNum = this.incrementCustomerNum(topCustomerData.customer_num, customerNumPrefix);
      //     }

      //     this.customerForm.patchValue({ customer_num: newCustomerNum });
      //     this.customerForm.patchValue({ site: '00000' });

      //   });
      // }
    });
  }
  private incrementCustomerNum(customerNum: string, codeFrom: string): string {
    const numPart = customerNum.replace(codeFrom, '');
    const num = parseInt(numPart, 10) + 1;
    const paddedNum = num.toString().padStart(numPart.length, '0');
    return codeFrom + paddedNum;
  }

  getCustomerTypeId(code: string): number | undefined {
    const type = this.listOfType.find(t => t.code === code);
    return type ? type.id : undefined;
  }

  onSearch(value: string): void {
    this.filteredItemsProvince = this.items_provinces.filter(item =>
      item.subdistrict.includes(value) ||
      item.district.includes(value) ||
      item.province.includes(value) ||
      item.postalCode.includes(value)
    );
  }

  onPostalCodeChange(value: any): void {
    // หา selected item โดยใช้ทั้ง postalCode และบางค่าเฉพาะ เช่น subdistrict
    const [postalCode, subdistrict] = value.split('-');
    const selectedItem = this.items_provinces.find(item => item.postalCode === postalCode && item.subdistrict === subdistrict);
    if (selectedItem) {
      this.customerForm.patchValue({
        district: selectedItem.district,
        subdistrict: selectedItem.subdistrict,
        province: selectedItem.province
      });
      this.cdr.markForCheck();
    }
  }

  isSubdistrictMatching(item: DataLocation): boolean {
    const currentSubdistrict = this.customerForm.get('subdistrict')?.value;
    return item.subdistrict === currentSubdistrict;
  }

  onSubmit(): void {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (this.isViewMode) {
      this.customerForm.enable(); // Enable form temporariliy for validation
    }
    // if (this.isSubmitting) {
    //   return; // ป้องกันการ submit ซ้ำ
    // }

    this.isSubmitting = true;
    if (!this.customerId) {
      this.customerForm.patchValue({ company: currentUser.company });
      console.log("!this.customerId");

    }
    this.CheckDupplicateData();
    console.log(this.customerForm.valid, this.customerForm.value);

    if (this.customerForm.valid) {
      const formValue = this.prepareFormData();
      const selectedPostItem = this.items_provinces.find(item => item.postalCode === formValue.postalCode && this.isSubdistrictMatching(item));
      if (selectedPostItem) {
        formValue.post_id = selectedPostItem.post_id;
      }
      console.log(selectedPostItem, formValue);
      this.tempCusForm = formValue;
      if (this.customerId) {
        this.onUpdate(formValue);  // Call update function if customerId exists
      } else {
        this.customerService.addData(formValue).subscribe({
          next: (response) => {
            this.customerForm.patchValue({ customer_id: response.customer_id });
            this.insertLog();
            this.UploadFile()
            // this.UpdatePath(customer_id)
            Swal.fire({
              icon: 'success',
              title: 'Saved!',
              text: 'Your data has been saved.',
              showConfirmButton: false,
              timer: 1500
            });
            this.router.navigate(['/feature/customer']);
          },
          error: (err) => {
            console.error('Error adding data', err);
          },
          complete: () => {
            this.isSubmitting = false; // รีเซ็ตค่าหลังจาก submit เสร็จ
          }
        });
      }
    } else {
      this.customerForm.markAllAsTouched();
      if (this.emailError !== '') {
        Swal.fire({
          icon: 'error',
          title: 'Email ไม่ถูกต้อง',
          text: 'โปรดตรวจสอบให้แน่ใจว่า Email ของคุณถูกต้อง',
          confirmButtonText: 'ปิด'
        });
        return;
      }
      else {
        Swal.fire('Error!', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
      }
      this.isSubmitting = false;

    }
  }


  onUpdate(formValue: any): void {
    if(this.customerId){
      formValue.id = this.customerId;
    }
    if (this.customerForm.valid && this.customerId) {
      this.UploadFile()
      this.customerService.updateData(this.customerId, formValue).subscribe({
        next: (response) => {
          this.customerForm.patchValue({ customer_id: this.customerId });
          this.insertLog();
          Swal.fire({
            icon: 'success',
            title: 'Updated!',
            text: 'Your data has been updated.',
            showConfirmButton: false,
            timer: 1500
          });
          this.sendEmailNotification();
          this.router.navigate(['/feature/customer']);
        },
        error: (err) => {
          console.error('Error updating data', err);
        }
      });
    } else {
      this.customerForm.markAllAsTouched();
      Swal.fire('Error!', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
    }
  }

  prepareFormData(): any {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (!currentUser) {
      console.error('Current user is not available in local storage');
      return;
    }
    const formValue = { ...this.customerForm.value };
    const selectedPostItem = this.items_provinces.find(item => {
      const postalCode = formValue.postalCode.split('-')[0];
      return item.postalCode === postalCode && this.isSubdistrictMatching(item);
    });

    if (selectedPostItem) {
      formValue.postalCode = selectedPostItem.postalCode; // ใช้ค่า postalCode ที่ถูกต้อง
      formValue.post_id = selectedPostItem.post_id; // เพิ่ม post_id เข้าไปใน formValue
    }
    if (this.listDataByTaxId) {
      formValue.id = 0
    }
    else if (!this.customerId) {
      delete formValue.id;
    }
    formValue.user_id = currentUser.user_id;
    return formValue;
  }

  getCustomerType(): void {
    this.customerService.getCustomerType().subscribe({
      next: (response: any) => {
        this.listOfType = response;
        console.log(this.listOfType);

        this.filteredDataType = response;
        this._cdr.markForCheck();
      },
      error: () => {
        // Handle error
      }
    });
  }

  insertLog(): void {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const customerId = this.customerForm.get('customer_id')?.value || this.customerId || 0;
    delete this.tempCusForm.post_id;
    this.customerForm.setValue(this.tempCusForm);
    console.log(this.customerForm);

    if (!currentUser) {
      console.error('Current user is not available in local storage');
      return;
    }
    if (this.customerForm.valid) {
      const log = {
        id: 0,
        user_id: currentUser.user_id || 0,
        username: currentUser.username || 'string',
        email: currentUser.email || 'string',
        status: this.customerForm.get('status')?.value || 'Draft',
        customer_id: customerId,
        supplier_id: 0,// อ้างอิง id จาก supplierForm
        time: new Date().toISOString(), // หรือใส่เวลาที่คุณต้องการ
        reject_reason: this.reasonTemp
      };
      this.customerService.insertLog(log).subscribe({
        next: (response) => {
        },
        error: (err) => {
          console.error('Error adding log data', err);
        }
      });
    } else {
      console.error('Supplier form or supplier bank form is not valid');
    }
  }

  getEventLogs(customerId: number): void {
    this.customerService.getLog(customerId).subscribe(
      (data) => {
        this.logs = data;
      },
      (error) => {
        console.error('Error fetching logs', error);
      }
    );
  }

  validateEmail() {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+(\.[a-zA-Z]{2,4}){1,2}$/;
    if (!this.customerForm.value.email) {
      this.emailError = 'Email is required';
    } else if (!emailPattern.test(this.customerForm.value.email)) {
      if (this.customerForm.value.email === '-') {
        this.emailError = '';
      }
      else {
        this.emailError = 'Email is wrong emailPattern';
      }
    } else {
      this.emailError = '';
    }
    this.cdr.detectChanges();
  }

  cancel(event: Event): void {
    event.preventDefault();
    Swal.fire({
      title: 'Are you sure?',
      text: "Do you want to cancel ?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, save it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.setStatusAndSubmit('Cancel');
      }
    });

  }

  save(event: Event): void {
    event.preventDefault();
    Swal.fire({
      title: 'Are you sure?',
      text: "Do you want to save the changes?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, save it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.setStatusAndSubmit('Draft');
      }
    });

  }

  checkSave(event: Event) {
    this.validateEmail();
    if (this.emailError && this.emailError.trim() !== '') {
      console.log('Swal should be fired');
      Swal.fire({
        icon: 'error',
        title: 'Email ไม่ถูกต้อง',
        text: 'โปรดตรวจสอบให้แน่ใจว่า Email ของคุณถูกต้อง',
        confirmButtonText: 'ปิด'
      });
      return;
    }
    else {
      this.CheckDupplicateData();
      this.save(event);
    }
  }

  submit(event: Event): void {

    event.preventDefault();
    Swal.fire({
      title: 'Are you sure?',
      text: "Do you want to save the changes?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, save it!'
    }).then((result) => {
      if (result.isConfirmed) {
        if (result.isConfirmed) {
          const currentStatus = this.customerForm.get('status')?.value;
          const newStatus = currentStatus === 'Pending Approved By ACC' ? 'Pending Approve By FN' : 'Pending Approved By ACC';
          this.setStatusAndSubmit(newStatus);
        }
      }
    });

  }

  approve(event: Event): void {
    event.preventDefault();
    Swal.fire({
      title: 'Are you sure?',
      text: "Do you want to Approve?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, save it!'
    }).then((result) => {
      if (result.isConfirmed) {
        const currentStatus = this.customerForm.get('status')?.value;
        const newStatus = currentStatus === 'Approved By ACC' ? 'Approved By FN' : 'Approved By ACC';
        this.setStatusAndSubmit(newStatus);
      }
    });
  }

  reject(event: Event): void {
    event.preventDefault();
    this.showRejectPopup().then((rejectReason) => {
      if (rejectReason !== undefined) {
        Swal.fire({
          title: 'Are you sure?',
          text: "Do you want to Reject?",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#3085d6',
          cancelButtonColor: '#d33',
          confirmButtonText: 'Yes, save it!'
        }).then((result) => {
          if (result.isConfirmed) {
            const currentStatus = this.customerForm.get('status')?.value;
            const newStatus = currentStatus === 'Approved By ACC' ? 'Reject By FN' : 'Reject By ACC';
            this.reasonTemp = rejectReason;
            this.setStatusAndSubmit(newStatus); // ส่งเหตุผลไปด้วย
          }
        });
      } else {
        // Swal.fire('Error!', 'กรุณากรอกเหตุผล', 'error');
      }
    });
  }

  showRejectPopup(): Promise<string | undefined> {
    return Swal.fire({
      title: 'Reject Reason',
      input: 'textarea',
      inputLabel: 'Please provide a reason for rejection',
      inputPlaceholder: 'Enter your reason here...',
      showCancelButton: true,
      confirmButtonText: 'Submit',
      cancelButtonText: 'Cancel',
      inputValidator: (value) => {
        if (!value) {
          return 'กรุณากรอกเหตุผล'
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        return result.value;
      }
      return undefined;
    });
  }


  setStatusAndSubmit(status: string): void {
    this.customerForm.patchValue({ status });
    if (!this.customerId) {
      this.customerForm.patchValue({ customer_num: this.newCusnum });
      console.log("625", this.customerForm.value);
    }


    this.onSubmit();
  }

  getTaxIdData(): void {
    const taxId = this.customerForm.get('tax_Id')?.value;

    if (taxId) {
      this.customerService.getDataByTaxId(taxId).subscribe({
        next: (dataList: any[]) => {
          if (dataList.length > 0) {
            this.listDataByTaxId = dataList

            // สมมติว่าเลือกแถวที่มี Id สูงสุด
            const latestData = dataList.reduce((prev, current) => (prev.id > current.id) ? prev : current);

            const postalCodeCombination = latestData.postalCode + '-' + latestData.subdistrict;
            this.customerForm.patchValue({
              ...latestData,
              postalCode: postalCodeCombination,
              status: ''
            });
            this.originalData = { ...latestData };
          } else {
          }
        },
        error: (err) => {
          console.error('Error fetching data by Tax ID', err);
        }
      });
    }
  }

  sendEmailNotification(): void {
    if (this.customerForm.get('status')?.value === 'Pending Approved By ACC' && this.customerForm.valid) {
      const company = this.customerForm.get('company')?.value;
      const customerNum = this.customerForm.get('customer_num')?.value;
      // เรียกใช้ฟังก์ชันเพื่อค้นหาผู้ใช้งาน
      this.customerService.findApproversByCompany(company).subscribe(
        (approvers) => {
          approvers.forEach((approver: any) => {
            const to = approver.email;
            const subject = 'Approval Notification';
            const body = `สถานะของ Customer Number:${customerNum} 
            ได้เปลี่ยนเป็น ${this.customerForm.get('status')?.value} 
            รบกวนเข้ามาดำเนินการตรวจสอบและ Approve ในลำดับต่อไป`;

            this.emailService.sendEmail(to, subject, body).subscribe(
              (response) => {

              },
              (error) => {
                console.error('Error sending email', error);
              }
            );
          });
        },
        (error) => {
          console.error('Error finding approvers', error);
        }
      );
    }
  }

  isDataUnchanged(existingData: any, newData: any): boolean {
    const fieldsToCompare = ['name', 'tax_Id', 'address_sup', 'district', 'subdistrict', 'province', 'tel', 'email', 'customer_num', 'customer_type', 'site'];


    const existingPostalCode = existingData.postalCode.split('-')[0];
    const newPostalCode = newData.postalCode.split('-')[0];

    for (const field of fieldsToCompare) {

      if (existingData[field] !== newData[field]) {
        return false;
      }
    }

    if (existingPostalCode !== newPostalCode) {
      return false;
    }

    return true; // ข้อมูลตรงกัน
  }

  compareWithExistingData(existingDataList: any[], newData: any): boolean {
    for (let existingData of existingDataList) {
      if (this.isDataUnchanged(existingData, newData)) {

        return true; // เจอข้อมูลซ้ำ
      }
    }

    return false; // ไม่มีข้อมูลซ้ำ
  }

  backClicked(event: Event): void {
    event.preventDefault();
    this._location.back();
  }

  onCustomerTypeChange(value: string): void {
    this.selectType = value;
  }

  isOverseaCustomer(): boolean {
    return this.selectType === 'OSEA';  // ตรวจสอบค่าซึ่งหมายถึง OSEA - ลูกหนี้ต่างประเทศ
  }

  CheckDupplicateData() {
    if (this.customerForm.value.customer_num === '') {
      const name = this.customerForm.value.name.trim(); // ตัดช่องว่างต้นและท้าย
      const site = this.customerForm.value.site.trim(); // ตัดช่องว่างต้นและท้าย

      // ตรวจสอบว่า name เป็นภาษาอังกฤษหรือไม่
      const isEnglish = /^[A-Za-z\s]+$/.test(name);
      const cleanedName = isEnglish ? name.replace(/\s+/g, '').toUpperCase() : name.replace(/\s+/g, '');
      const key = site + cleanedName;

      console.log("Generated key for CheckDupplicateCustomer:", key);

      this.customerService.CheckDupplicateCustomer(key).subscribe({
        next: (response: any) => {
          console.log("Response from CheckDupplicateCustomer:", response);

          if (response && response.length > 0) {
            Swal.fire({
              icon: 'error',
              title: 'ข้อมูลซ้ำ',
              text: 'มีข้อมูล Customer นี้อยู่ในฐานข้อมูลอยู่แล้ว โปรดตรวจสอบ Name และ Site อีกครั้ง',
              confirmButtonText: 'ปิด'
            });
            return;
          }
        },
        error: (err) => {
          if (err === 'No customers found.') {
            console.log("ไม่พบข้อมูลซ้ำ, ดำเนินการหาข้อมูลเลขล่าสุด...");

            // เมื่อไม่พบข้อมูลซ้ำ ให้เรียก GetNumMaxCustomer
            this.customerService.GetNumMaxCustomer(this.typeCode).subscribe({
              next: (response: any) => {
                console.log("Response from GetNumMaxCustomer:", response);

                if (!response || response.length === 0 || response[0]["MAX(NUM)"] === null) {
                  this.customerForm.patchValue({ customer_num: '' });
                  console.log("No customers found, setting customer_num to empty.");
                } else {
                  const max = response[0]["MAX(NUM)"];
                  const maxStr = String(max);
                  console.log("Max Customer Num String:", maxStr);

                  // แยกตัวอักษรและตัวเลข โดยให้แน่ใจว่าตัวอักษรอยู่ข้างหน้า และตัวเลขอยู่ข้างหลัง
                  const matchResult = maxStr.match(/^(\d*[A-Za-z]+)(\d+)$/);
                  const prefix = matchResult ? matchResult[1] : ''; // ตัวอักษรที่รวมตัวเลขแรกด้วย เช่น "1A"
                  const numPart = matchResult ? matchResult[2] : '0'; // เลขส่วนท้าย เช่น "007447"

                  // แสดงค่า prefix และ numPart เพื่อให้แน่ใจว่าถูกต้อง
                  console.log("Prefix:", prefix); // ควรจะเป็น "1A"
                  console.log("NumPart:", numPart); // ควรจะเป็น "007447"

                  // แปลง numPart เป็นตัวเลข บวก 1
                  const nextNum = String(parseInt(numPart, 10) + 1).padStart(numPart.length, '0');
                  console.log("Next Num after increment:", nextNum); // ควรจะเป็น "007448"

                  // ประกอบ prefix และเลขใหม่เข้าด้วยกัน
                  const newCustomerNum = `${prefix}${nextNum}`;
                  this.newCusnum = newCustomerNum;
                  // อัปเดตค่าใน form
                  this.customerForm.setValue({ ...this.customerForm.value, customer_num: newCustomerNum });
                  console.log("New Customer Num:", newCustomerNum);
                  console.log("New Customer Num:", this.customerForm.value);
                  this._cdr.markForCheck();
                }

                this._cdr.markForCheck();
              },
              error: (err) => {
                console.error('Error while fetching max customer number', err);
              }
            });
          } else {
            console.error("Error occurred during CheckDupplicateCustomer:", err);
          }
        }
      });
    }
  }

  onFileSelected(event: Event, file: any): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const selectedFile = input.files[0];

      // ตรวจสอบชนิดของไฟล์
      const fileType = selectedFile.type;
      if (fileType !== 'application/pdf') {
        Swal.fire({
          icon: 'error',
          title: 'ชนิดของไฟล์ไม่ถูกต้อง',
          text: 'ชนิดของไฟล์ต้องเป็น .PDF เท่านั้น',
          confirmButtonText: 'ปิด'
        });
        input.value = ''; // รีเซ็ต input file
        return;
      }

      // ตรวจสอบขนาดของไฟล์ (ขนาดไฟล์จะถูกวัดในหน่วย bytes, 1MB = 1,048,576 bytes)
      const maxSizeInMB = 5;
      const maxSizeInBytes = maxSizeInMB * 1048576; // 5MB in bytes
      if (selectedFile.size > maxSizeInBytes) {
        Swal.fire({
          icon: 'error',
          title: 'ขนาดของไฟล์ไม่ถูกต้อง',
          text: 'ขนาดของไฟล์ต้องไม่เกิน 5 MB ',
          confirmButtonText: 'ปิด'
        });
        input.value = ''; // รีเซ็ต input file
        return;
      }
      // ถ้าไฟล์ผ่านการตรวจสอบทั้งชนิดและขนาด
      this.listfile.push(selectedFile);
      console.log('Selected file:', this.listfile);
    }
  }

  UploadFile() {
    this.listfile.forEach((file) => {
      const formData = new FormData();
      formData.append('file', file, file.name);
      this.customerService.uploadFile(formData).subscribe({
        next: (response: any) => {
          this.uploadedFiles.push(response)
          this.customerForm.value.path = response.filePath;
          this.customerForm.value.file_req = this.uploadedFiles[0].fileName;
          this.customerForm.value.file_certificate = this.uploadedFiles[1].fileName;
          if(this.customerId === null && this.customerId === undefined){
            this.customerService.updateData(this.customerId, this.customerForm.value).subscribe({
              next: (response) => {
              },
              error: (err) => {
                console.error('Error updating data', err);
              }
            });  
          }
        },
        error: () => {
          // Handle error
        }
      });
    });
    this.listfile = [];
  }

  // UpdatePath(id : number , value){
  //   this.customerService.updateData(id, formValue).subscribe({
  //     next: (response) => {
  //     },
  //     error: (err) => {
  //       console.error('Error updating file', err);
  //     }
  //   });
  // }


}
